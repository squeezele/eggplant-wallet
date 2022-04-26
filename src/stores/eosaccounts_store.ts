import { runInAction, makeAutoObservable } from "mobx";
import AnchorLink, { ChainId, LinkSession } from 'anchor-link'
import AnchorLinkBrowserTransport from 'anchor-link-browser-transport'
import { IdentityProof } from 'eosio-signing-request'
import { formatAmount, getAmount } from "../utils";
import { gConn, IActionSubmitResult } from '../rt';
import axios from 'axios';
import { getGlobalState } from "mobx/dist/internal";

const ANCHOR_LINK_SESSION = 'anchor-link-session';
const PEOS_CONTRACT = 'thepeostoken';
const CHAIN_ID = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
const NODE_URL = 'https://eos.greymass.com:443';
const REFUND_TIME = 3600 * 24 * 3

const getCurrencyBalance = async (code: string, account_name: string, symbol: string): Promise<number> => {
    const body = {
        account: account_name,
        code: code,
        symbol: symbol
    }

    const res = await axios.post(NODE_URL + '/v1/chain/get_currency_balance', JSON.stringify(body));

    if (res.status != 200) {
        return 0.0;
    }
    
    return getAmount(res.data[0]);
}

interface IStakeData {
    quantity: number;
    lastDividendsFrac: number;
}

const getStakedPeos = async (account: string): Promise<IStakeData> => {
    let body = {
        "json": true,
        "code": PEOS_CONTRACT,
        "scope": account,
        "table": "staked",
        "table_key": "",
        "limit": 1,
        "reverse": false,
        "show_payer": false
    }

    const res = await axios.post(NODE_URL + '/v1/chain/get_table_rows', JSON.stringify(body));

    if (res.status != 200) {
        return null;
    }

    let rows = res.data.rows
    if (rows !== undefined && rows.length > 0) {
        return {
            quantity: getAmount(rows[0].quantity),
            lastDividendsFrac: parseFloat(rows[0].lastDividendsFrac)
        }
    } 

    return {
        quantity: 0,
        lastDividendsFrac: 0
    };
}

interface IGlobalStakeData {
    totalStaked: number;
    totalDividends: number;
    totalUnclaimedDividends: number;
    totalDividendFrac: number;
}

const getGlobalStakeData = async (): Promise<IGlobalStakeData> => {
    let body = {
        "json": true,
        "code": PEOS_CONTRACT,
        "scope": PEOS_CONTRACT,
        "table": "dividends",
        "table_key": "",
        "limit": 1,
        "reverse": false,
        "show_payer": false
    }

    const res = await axios.post(NODE_URL + '/v1/chain/get_table_rows', JSON.stringify(body));

    if (res.status != 200) {
        throw res;
    }

    let rows = res.data.rows
    console.log(rows);
    if (rows !== undefined && rows.length > 0) {
        const d = rows[0];
        return {
            totalStaked: getAmount(d.totalStaked),
            totalDividends: getAmount(d.totalDividends),
            totalUnclaimedDividends: getAmount(d.totalUnclaimedDividends),
            totalDividendFrac: parseFloat(d.totalDividendFrac)
        };
    } 

    return {
        totalStaked: 0.0,
        totalDividends: 0.0,
        totalUnclaimedDividends: 0.0,
        totalDividendFrac: 0.0
    };
}

interface IRefundData {
    requestTime: number;
    refunding: number;
}

const getRefundPeos = async (account: string): Promise<IRefundData> => {
    let body = {
        "json": true,
        "code": PEOS_CONTRACT,
        "scope": account,
        "table": "refunds",
        "table_key": "",
        "limit": 1,
        "reverse": false,
        "show_payer": false
    }

    const res = await axios.post(NODE_URL + '/v1/chain/get_table_rows', JSON.stringify(body));

    if (res.status != 200) {
        return {
            requestTime: 0,
            refunding: 0
        }
    }

    let rows = res.data.rows
    if (rows !== undefined && rows.length > 0) {
        return {
            requestTime: rows[0].request_time,
            refunding: getAmount(rows[0].amount)
        }
    } 

    return {
        requestTime: 0,
        refunding: 0
    }
}


export interface IUTXOInput {
    id: number;
    sig: string;
}
export interface IUTXOOutput {
    pk: string;
    account: string;
    quantity: string;
}

export const EOSAccountsStore = () => {
    return makeAutoObservable({
        account: null,
        link: null as AnchorLink,
        session: null as LinkSession,
        sessions: null,
        proof: null,
        proofValid: false,
        peosOnAccount: 0.0,
        peosStaked: 0.0,
        peosRefunding: 0.0,
        peosRefundRequestTime: 0,
        peosDividends: 0,
        globalStakeData: {} as IGlobalStakeData,

        setProofValid(valid: boolean) {
            this.proofValid = valid;
        },

        setPeosStaked(amount: number) {
            this.peosStaked = amount;
        },

        async refreshAccount() {
            const { client } = this.link;

            this.account = await client.v1.chain.get_account(this.session.auth.actor);

            const auth = this.session.auth
            console.log('*** refresh account ***', auth)

            await this.updatePeosOnAccount();

            this.proofValid = true;
        },

        async establishLink() {
            const link = new AnchorLink({
                chains: [{
                   chainId: CHAIN_ID,
                   nodeUrl: NODE_URL
                }],
                transport: new AnchorLinkBrowserTransport({}),
            });
            this.link = link;

            this.session = await link.restoreSession(ANCHOR_LINK_SESSION);

            if (this.session) {
                this.refreshAccount();
            }
        },

        async logout() {
            const link = this.link;
            await link.removeSession(ANCHOR_LINK_SESSION, this.session.auth, this.session.chainId);
            
            this.session = undefined;
            this.proof = undefined;
            this.proofKey = undefined;
            this.setProofValid(false);
        },

        async login() {
            const link = this.link;
            const identity = await link.login(ANCHOR_LINK_SESSION);

            const { session } = identity;
            this.session = session;

            await this.refreshAccount();

            // Create a proof helper based on the identity results from anchor-link
            const proof = IdentityProof.from(identity.proof);

            // Retrieve the auth from the permission specified in the proof
            const auth = this.account.getPermission(proof.signer.permission).required_auth;

            // Determine if the auth is valid with the given proof
            const valid = proof.verify(auth, this.account.head_block_time);

            // If not valid, throw error
            if (!valid) {
                throw new Error('Proof invalid or expired');
            }

            // Recover the key from this proof
            const proofKey = proof.recover();

            runInAction(()=>{
                this.proof = proof;
                this.proofKey = proofKey;
                this.proofValid = valid;
            });
        },

        async updatePeosOnAccount() {
            const account = this.account.account_name.toString();

            this.peosOnAccount = await getCurrencyBalance(PEOS_CONTRACT, account, 'PEOS');
            const sd: IStakeData = await getStakedPeos(account);
            const rd: IRefundData = await getRefundPeos(account);
            this.globalStakeData = await getGlobalStakeData();
    
            this.setPeosStaked(sd.quantity);
            this.peosRefunding = rd.refunding;
            this.peosRefundRequestTime = rd.requestTime;      
            this.peosDividends = this.peosStaked * (this.globalStakeData.totalDividendFrac - sd.lastDividendsFrac);
        },

        async stakePEOS(amount: number) {
            const { session } = this;
            const auth = session.auth || ''
            const accountName = this.account.account_name.toString();
            const permission = auth.permission.toString();

            const action = {
                account: PEOS_CONTRACT,
                name: 'stake',
                data: {
                    owner: accountName,
                    quantity: formatAmount(amount, 'PEOS'),
                },
                authorization: [{
                    actor: accountName,
                    permission
                }]
            };

            console.log('action: ', action);

            const res = await session.transact({
                actions: [action],
            }, {
                broadcast: true,
            });

            console.log('result: ', res);

            return res;
        },

        async unstakePEOS(amount: number) {
            const { session } = this;
            const auth = session.auth || ''
            const accountName = this.account.account_name.toString();
            const permission = auth.permission.toString();

            console.log(amount, typeof amount);

            const action = {
                account: PEOS_CONTRACT,
                name: 'unstake',
                data: {
                    owner: accountName,
                    quantity: formatAmount(amount, 'PEOS'),
                },
                authorization: [{
                    actor: accountName,
                    permission
                }]
            };

            console.log('action: ', action);

            const res = await session.transact({
                actions: [action],
            }, {
                broadcast: true,
            });

            console.log('result: ', res);

            return res;
        },

        async realizeDividends() {
            const { session } = this;
            const auth = session.auth || ''
            const accountName = this.account.account_name.toString();
            const permission = auth.permission.toString();

            const action = {
                account: PEOS_CONTRACT,
                name: 'realizediv',
                data: {
                    owner: accountName,
                },
                authorization: [{
                    actor: accountName,
                    permission
                }]
            };

            const res = await session.transact({
                actions: [action],
            }, {
                broadcast: true,
            });

            return res;
        },

        async refundStaked() {
            const { session } = this;
            const auth = session.auth || ''
            const accountName = this.account.account_name.toString();
            const permission = auth.permission.toString();

            const action = {
                account: PEOS_CONTRACT,
                name: 'refund',
                data: {
                    owner: accountName,
                },
                authorization: [{
                    actor: accountName,
                    permission
                }]
            };

            const res = await session.transact({
                actions: [action],
            }, {
                broadcast: true,
            });

            return res;
        },

        async sendToPEOSAddress(address:string, amount: number) {
            const { session } = this;
            const auth = session.auth || ''
            const accountName = this.account.account_name.toString();
            const permission = auth.permission.toString();

            const action = {
                account: PEOS_CONTRACT,
                name: 'loadutxo',
                data: {
                    from: accountName,
                    pk: address,
                    quantity: formatAmount(amount, 'PEOS'),
                },
                authorization: [{
                    actor: accountName,
                    permission
                }]
            };

            console.log('action: ', action);

            const res = await session.transact({
                actions: [action],
            }, {
                broadcast: true,
            });

            console.log('result: ', res);

            return res;
        },

        makeTransferAction(inputs: IUTXOInput[], outputs: IUTXOOutput[], memo: string) {
            const { session } = this;
            // const auth = session.auth || ''
            const accountName = '';//this.account.account_name.toString();
            const permission = '';//auth.permission.toString();

            const action = {
                account: PEOS_CONTRACT,
                name: 'transferutxo',
                data: {
                    payer: accountName,
                    inputs,
                    outputs,
                    memo
                },
                authorization: [{
                    actor: accountName,
                    permission
                }]
            };

            return action;
        },

        async transfer(action: any): Promise<IActionSubmitResult> {            
            const res = await gConn.broadcastAction(action);
            return res;
        },

        getRefundTime(): number {
            return this.peosRefundRequestTime + REFUND_TIME - Math.round((new Date()).getTime() / 1000)
        }
    });
};
