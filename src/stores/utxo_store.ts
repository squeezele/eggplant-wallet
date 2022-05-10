import { makeAutoObservable } from 'mobx';
import { mnemonicToSeedSync, validateMnemonic } from 'bip39';
import { PrivateKey } from 'eosjs/dist/PrivateKey';
import { KeyType } from 'eosjs/dist/eosjs-numeric';
import { ec as EC } from 'elliptic';
import axios from 'axios';
import HDNode from 'hdkey';
import { gConn } from '../rt';
import { encrypt, decrypt, getAmount, formatAmount } from '../utils';

export interface UTXO {
    id: number;
    hd_index: number;
    unonymity_set: number;
    pk: string,
    private_key: PrivateKey;
    amount: number;
    payer: string;
    comment: string;
}
export interface UTXODto {
    id: number;
    pk: string,
    amount: string;
    payer: string;
}

interface ISaveData {
    version: number;
    utxos: UTXO[];
    HDIndex: number;
    activeReceiveAddresses: number[];
}

let hdkey: any;

const ec = new EC("secp256k1");
const keyType = KeyType.k1;

export const UTXOStore = (mnemonic: string) => {
    const SEED_KEY = 'MNEMONIC_SEED';
    const WALLET_DATA_KEY = 'WALLET_DATA_KEY';

    //const seed = mnemonicToSeedSync(mnemonic);
    //hdkey = HDNode.fromMasterSeed(seed);

    return makeAutoObservable({
        HDIndex: 0,
        utxos: [] as UTXO[],
        activeReceiveAddresses: [] as number[],
        isSetup: !!localStorage.getItem(SEED_KEY),
        priceInEOS: 0,
        priceInUSD: 0,

        clear() {
            this.utxos = [];
        },

        add(utxo: UTXO) {
            this.utxos.push(utxo);
            this.save();
        },

        remove(id: number) {
            this.utxos.map((utxo: UTXO)=>{
                if (utxo.id === id) {
                    utxo.amount = 0.0;
                }
            });
            this.save();
        },

        removeByPk(pk: string) {
            this.utxos.map((utxo: UTXO)=>{
                if (utxo.pk === pk) {
                    utxo.amount = 0.0;
                }
            });
            this.save();
        },

        get nonZero(): UTXO[] {
            return this.utxos.filter((utxo:UTXO)=>utxo.amount>0);
        },

        get totalAmount(): number {
            let sum = 0.0;
            this.utxos.map((utxo: UTXO)=>{
                sum += utxo.amount;
            })
            return sum;
        },

        create_new(comment: string): UTXO {
            const privateKey = this.get_key(this.HDIndex);
            const utxo: UTXO = {
                id: -1,
                hd_index: this.HDIndex,
                unonymity_set: 0,
                pk: privateKey.getPublicKey().toLegacyString(),
                private_key: privateKey,
                amount: 0,
                comment,
                payer: '',
            };
            this.utxos.push(utxo);
            this.HDIndex += 1;
            return utxo;
        },

        create_receive_address(comment: string): UTXO {
            const utxo = this.create_new(comment);
            this.activeReceiveAddresses.push(utxo.hd_index);
            this.save();
            return utxo;
        },

        drop_last_receive_address(): UTXO {
            const utxo = this.utxos.pop();
            this.activeReceiveAddresses.pop();
            this.HDIndex -= 1;
            this.save();
            return utxo;
        },

        get_key(sequence: number): PrivateKey {
            if (!hdkey) {
                throw new Error('Locked');
            }

            const hdnode = hdkey.derive(`m/44/42/0/0/${sequence}`);
            const pair = ec.keyFromPrivate(hdnode.privateKey);
            return PrivateKey.fromElliptic(pair, keyType);
        },

        updateUTXO(utxo: UTXODto) {
            this.remove(utxo.id);

            let updated = false;
            for(const i in this.utxos) {
                const u: UTXO = this.utxos[i];
                if (u.id >= 0 && u.id === utxo.id) {
                    u.amount = getAmount(utxo.amount);
                    u.payer = utxo.payer;
                    updated = true;
                    break;
                }
            }
            
            if(!updated) {
                // Find utxo with same key
                let samePkUtxo: UTXO = null;
                for(const i in this.utxos) {
                    const u: UTXO = this.utxos[i];
                    if (u.pk === utxo.pk) {
                        samePkUtxo = u
                        break;
                    }
                }

                if (samePkUtxo) {
                    let nu: UTXO = {...samePkUtxo}
                    nu.id = utxo.id;
                    nu.amount = getAmount(utxo.amount);
                    nu.payer = utxo.payer;
                    this.utxos.push(nu);
                }
            }

            // Clear receiving
            this.activeReceiveAddresses = this.activeReceiveAddresses.filter((hd_index: number) => 
                                                                    this.utxos[hd_index].amount <= 0);

            this.save();
        },

        getByHDIndex(hdIndex: number): UTXO {
            for(const i in this.utxos) {
                if(this.utxos[i].hd_index == hdIndex) {
                    return this.utxos[i];
                }
            }
        },

        getById(id: number): UTXO {
            for(const i in this.utxos) {
                if(this.utxos[i].id == id) {
                    return this.utxos[i];
                }
            }
        },

        storeSeed(seed: string, password: string) {
            const encrypted = encrypt(seed, password);
            localStorage.setItem(SEED_KEY, encrypted);
            this.isSetup = true;
        },

        getSeed(password: string): string {
            const seedEncrypted = localStorage.getItem(SEED_KEY);
            if (!seedEncrypted)
                return;
            return decrypt(seedEncrypted, password);
        },

        unlock(password: string): boolean {
            const seed = this.getSeed(password);
            const isValid = validateMnemonic(seed);
            if (!isValid) {
                return false;
            }

            const trueSeed = mnemonicToSeedSync(seed);
            hdkey = HDNode.fromMasterSeed(trueSeed);

            return true;
        },

        lock() {
            hdkey = undefined;
        },

        wipe() {
            console.log('***WIPE***');
            this.lock();
            this.clear();
            this.HDIndex = 0;
            this.activeReceiveAddresses.clear();
            localStorage.removeItem(WALLET_DATA_KEY);
            localStorage.removeItem(SEED_KEY);
        },

        get isUnlocked(): boolean {
            return !!hdkey;
        },

        async syncWithBlockchain() {
            console.log('Sync with blockchain');
            this.updatePriceInEOS();
            this.updatePriceInUSD();

            let newUtxos: UTXO[] = [];
            for(let i = 0; i < this.HDIndex; i += 1 ) {
                const privateKey = this.get_key(i);
                const publicKey = privateKey.getPublicKey().toLegacyString();

                const bUTXO: UTXODto[] = await gConn.getUTXOs([publicKey]);

                if (bUTXO.length === 0) {
                    bUTXO.push({
                        id: 0,
                        pk: publicKey,
                        amount: formatAmount(0, 'PEOS'),
                        payer: '',
                    });
                }

                bUTXO.map((bu: UTXODto) => {
                    const nu: UTXO = {
                        id: bu.id,
                        hd_index: i,
                        unonymity_set: 0,
                        pk: privateKey.getPublicKey().toLegacyString(),
                        private_key: privateKey,
                        amount: getAmount(bu.amount),
                        comment: '',
                        payer: bu.payer,
                    };

                    newUtxos.push(nu);
                });
            }
            this.utxos.clear();
            this.utxos.push(...newUtxos);

            this.save();
            console.log('Sync with blockchain finished');
        },

        async save() {
            const data: ISaveData = {
                version: 0,
                HDIndex: this.HDIndex,
                utxos: this.utxos,
                activeReceiveAddresses: this.activeReceiveAddresses,
            };

            const strippedString = JSON.stringify(data, (k: string, v: any) => k !== 'private_key' ? v : undefined)
            localStorage.setItem(WALLET_DATA_KEY, strippedString);
        },

        async load() {
            const strippedString = localStorage.getItem(WALLET_DATA_KEY);
            if(!strippedString) {
                return;
            }

            const data: ISaveData = JSON.parse(strippedString);
            if (data.version !== 0) {
                return;
            }

            this.utxos.clear();
            data.utxos.forEach(utxo=>{
                utxo.private_key = this.get_key(utxo.hd_index);
                this.utxos.push(utxo);
            })
            this.HDIndex = data.HDIndex;
            this.activeReceiveAddresses = data.activeReceiveAddresses;
        },

        async updatePriceInEOS() {
            const res = await axios.get('https://api.newdex.io/v1/ticker?symbol=thepeostoken-peos-eos');
            if (res.data.code != 200) {
                return -1.0;
            }
            this.setPriceInEOS(res.data.data.last);
        },

        setPriceInEOS(priceInEOS: number) {
            this.priceInEOS = priceInEOS
        },

        async updatePriceInUSD() {
            const res = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=EOSUSDT');
            const price = parseFloat(res.data.price);
            console.log(this.priceInEOS, price);
            this.priceInUSD = this.priceInEOS * price;
        },
    })
};
