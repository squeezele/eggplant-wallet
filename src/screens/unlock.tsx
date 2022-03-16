
import * as React from 'react';
import { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { useStore } from '../stores';
import { SettingOutlined } from '@ant-design/icons';
import { Button, Space, Tabs, Input, Form, Checkbox } from 'antd';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { delay } from '../utils';
import { LockOutlined } from '@ant-design/icons';
import { gConn } from '../rt';
import FullscreenComponent from '../components/fullscreen';

interface IFormData {
    password: string;
}

const WalletUnlock = observer(() => {
    const { utxos, eosAccounts } = useStore();
    const [ form ] = Form.useForm();
    const navigate = useNavigate();

    const [ loading, setLoading ] = useState(false);

    const onSubmit = async (data: IFormData) => {
        if (loading) {
            return;
        }

        setLoading(true);

        if (utxos.unlock(data.password)) {
            console.log(1);
            gConn.connect(utxos);
            console.log(2);
            await eosAccounts.establishLink();
            console.log(3);
            setLoading(false);

            navigate('/');
            return;
        }

        await delay(3000);

        setLoading(false);
    };

    useEffect(()=>{
        //onSubmit({ password: '12345'});
    });

    return <FullscreenComponent inner={<>
        <h2>Welcome to 🍆 Wallet</h2>
        <p>You will first need unlock your wallet</p>

        <Form
            name="rec_form"
            layout="vertical"
            form={form}
            onFinish={onSubmit}
            requiredMark="optional"
        >
            <Form.Item
                label="Password"
                tooltip=""
                name="password"
                rules={[
                    { required: true, message: 'Please input your password!' },
                ]}
            >
                <Input.Password />
            </Form.Item>

            <Button
                type="primary"
                htmlType="submit"
                icon={<LockOutlined />}
                loading={ loading }
            >
                Unlock
            </Button>
        </Form>
    </>
    }/>
});

export default WalletUnlock;

