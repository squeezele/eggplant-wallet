import * as React from 'react';
import { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { Statistic, Row, Space, Divider, Button, Tabs, Input, Form } from 'antd';
import { PoweroffOutlined, LogoutOutlined } from '@ant-design/icons';
const { TabPane } = Tabs;
import { useStore } from '../stores';
import { formatAmount, delay } from '../utils';
import { gConn } from '../rt';
import humanizeDuration from 'humanize-duration'

interface ILoadUTXOFormData {
    address: string;
    amount: number;
}

interface IStakeFormData {
    amount: number;
}

const EOSAccountInformation = observer(() => {
    const [ form ] = Form.useForm();

    const { eosAccounts, utxos } = useStore();
    const { account } = eosAccounts;

    const onSubmit = async (data: any) => {
        try {
            const u = utxos.create_receive_address(`Loaded from EOS account`);
            
            const formData:  ILoadUTXOFormData = {
                address: u.pk,
                amount: parseFloat(data.amount),
            }

            await eosAccounts.sendToPEOSAddress(formData.address, formData.amount);
            await gConn.getUTXOs([u.pk]);
        } catch (err: any) {
            const u = utxos.drop_last_receive_address();
            await gConn.stopListenUTXOs([u.pk]);
        }
        await delay(2000);
        await eosAccounts.updatePeosOnAccount();
    }

    const onStakeSubmit = async (data: any) => {
        const formData:  IStakeFormData = {
            amount: parseFloat(data.amount),
        }
        await eosAccounts.stakePEOS(formData.amount);
        await delay(2000);
        await eosAccounts.updatePeosOnAccount();
    }

    const onUnstakeSubmit = async (data: any) => {
        const formData:  IStakeFormData = {
            amount: parseFloat(data.amount),
        }
        
        await eosAccounts.unstakePEOS(formData.amount);
        await delay(2000);
        await eosAccounts.updatePeosOnAccount();
    }

    const onRefund = async (data: any) => {       
        await eosAccounts.refundStaked();
    }

    useEffect(()=>{
        const handle = setInterval(()=>{
            eosAccounts.updatePeosOnAccount();
        }, 10000);

        return ()=> {
            clearInterval(handle);
        }
    });



    return <>
        <Divider orientation="left">Connected EOS wallet information</Divider>
        <Row justify='center'>
            <Statistic
                style={{width: '220px'}}
                title='Acount name'
                valueRender={()=><>
                    <Space>
                    <a target={'_external'} href={`https://bloks.io/account/${account.account_name.toString()}/`}>{account.account_name.toString()}</a>
                    <LogoutOutlined alt='logout' onClick={async ()=>{
                        await eosAccounts.logout();
                    }}/>
                    </Space>
                    </>}
            />
            <Statistic
                style={{width: '220px'}}
                title='CPU'
                valueRender={()=><>{String(account.cpu_limit.available)}μs / {String(account.cpu_limit.max)}μs</>}
            />
            <Statistic
                style={{width: '220px'}}
                title='Net'
                valueRender={()=><>{String(account.net_limit.available)}μs / {String(account.net_limit.max)}μs</>}
            />
        </Row>
        <Row justify='end'>
            <em style={{fontSize: '80%', marginTop: '12px'}}>
                * <b>WARNING:</b> Actions here are signed with your external account like normal
                EOS transactions, hence totally visible on the blockchain. 
            </em>
        </Row>
        <Divider />
        <Row>
            <Statistic
                style={{width: '180px'}}
                title='Balance'
                valueRender={()=><>{formatAmount(eosAccounts.peosOnAccount)}</>}
                value={eosAccounts.peosOnAccount}
            />
            <Statistic
                style={{width: '180px'}}
                title='Staked'
                valueRender={()=><>{formatAmount(eosAccounts.peosStaked)}</>}
                value={eosAccounts.peosStaked}
            />
            <Statistic
                style={{width: '180px'}}
                title='Unstaking'
                value={eosAccounts.getRefundTime()}
                valueRender={()=><>
                    { formatAmount(eosAccounts.peosRefunding) }
                    { eosAccounts.peosRefunding > 0 ?
                        <div onClick={onRefund} className="refund-time">Available in {humanizeDuration(eosAccounts.getRefundTime() * 1000, { largest: 2 })}</div>
                    :
                        <></>
                    }
                </>}
            />
            <Statistic
                style={{width: '180px'}}
                title='Dividends'
                valueRender={()=><>{formatAmount(eosAccounts.peosDividends)}</>}
                value={eosAccounts.peosDividends}
            />
        </Row>
        <Divider />
        <Tabs type="card">
            <TabPane tab="Load PEOS from EOS account" key="1">
                <Form
                    name="rec_form"
                    layout="vertical"
                    form={form}
                    onFinish={onSubmit}
                >
                    <Form.Item
                        label="PEOS amount to load"
                        tooltip="PEOS amount to load from your EOS account to your PEOS wallet"
                        name="amount"
                        rules={[
                            {
                                validator: (_, value) => parseFloat(value) <= eosAccounts.peosOnAccount ? Promise.resolve() : Promise.reject(new Error('Not enough funds on EOS wallet'))
                            },
                            {
                                validator: (_, value) =>
                                    parseFloat(value) > 0 ? Promise.resolve() : Promise.reject(new Error('Amount should be greated than zero'))
                            },
                        ]}
                    >
                        <Input type="number"/>
                    </Form.Item>

                    <Button type="primary" htmlType="submit">
                        Send
                    </Button>
                </Form>
            </TabPane>
            <TabPane tab="Stake" key="3">
                <Form
                    name="stake_form"
                    layout="vertical"
                    form={form}
                    onFinish={onStakeSubmit}
                >
                    <Form.Item
                        label="PEOS amount to stake"
                        tooltip="PEOS amount to stake"
                        name="amount"
                        rules={[
                            {
                                validator: (_, value) => parseFloat(value) <= eosAccounts.peosOnAccount ? Promise.resolve() : Promise.reject(new Error('Not enough funds on EOS wallet'))
                            },
                            {
                                validator: (_, value) =>
                                    parseFloat(value) > 0 ? Promise.resolve() : Promise.reject(new Error('Amount should be greated than zero'))
                            },
                        ]}
                    >
                        <Input type="number"/>
                    </Form.Item>

                    <Button type="primary" htmlType="submit">
                        Stake
                    </Button>
                </Form>
            </TabPane>
            <TabPane tab="Unstake" key="4">
                <Form
                    name="unstake_form"
                    layout="vertical"
                    form={form}
                    onFinish={onUnstakeSubmit}
                >
                    <Form.Item
                        label="PEOS amount to unstake"
                        tooltip="PEOS amount to unstake"
                        name="amount"
                        rules={[
                            {
                                validator: (_, value) => parseFloat(value) <= eosAccounts.peosStaked ? Promise.resolve() : Promise.reject(new Error('Must be less than your staked amount'))
                            },
                            {
                                validator: (_, value) =>
                                    parseFloat(value) > 0 ? Promise.resolve() : Promise.reject(new Error('Amount should be greated than zero'))
                            },
                        ]}
                    >
                        <Input type="number"/>
                    </Form.Item>

                    <Button type="primary" htmlType="submit">
                        Unstake
                    </Button>
                </Form>
            </TabPane>
        </Tabs>
    </>
});

const EOSWallet = observer(()=>{
    const { eosAccounts } = useStore();
	const [ loading, setLoading ] = useState(false);

    const loginClicked = async () => {
        setLoading(true);
        await eosAccounts.establishLink()
        try {
            await eosAccounts.login();
        } catch (e){
            console.log(e);
        }
        setLoading(false);
    };

	return (
		<Space style={{ width: '100%' }}>
            {eosAccounts.proofValid ?
                <EOSAccountInformation/>
                :
                <Button
                    type="primary"
                    icon={<PoweroffOutlined />}
                    loading={ loading }
                    onClick={ loginClicked }
                >
                    Connect EOS account
                </Button>
            }
		</Space>
	);
});

export default EOSWallet;
