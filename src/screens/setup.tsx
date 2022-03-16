
import * as React from 'react';
import { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { useStore } from '../stores';
import { SettingOutlined } from '@ant-design/icons';
import { generateMnemonic, validateMnemonic } from 'bip39';
import { Button, Input, Form, Checkbox } from 'antd';
import { useNavigate } from 'react-router-dom';
import FullscreenComponent from '../components/fullscreen';

interface IFormData {
    seed: string;
    password: string;
    password2: string;
    verifyWrittenDown: boolean;
}

const WalletSetup = observer(() => {
    const { utxos } = useStore();
    const [ form ] = Form.useForm();
    const navigate = useNavigate();

    const onSubmit = (data: IFormData) => {
        utxos.storeSeed(data.seed, data.password);
        navigate('/');
    };

    const newSeedClicked = () => {
        const seed = generateMnemonic();
        console.log(seed)
        form.setFieldsValue({seed});
    };

    useEffect(() => {
       newSeedClicked();
    });

    return <FullscreenComponent inner={<>
        <h2>Welcome to 🍆 Wallet</h2>
        <p>You will first need to create your 12 word seed</p>

        <Form
            name="rec_form"
            layout="vertical"
            form={form}
            onFinish={onSubmit}
            requiredMark={false}
        >
            <Form.Item
                label="Seed words"
                tooltip=""
                name="seed"
                rules={[{
                    validator: (_, value) =>
                    validateMnemonic(value) ? Promise.resolve() : Promise.reject(new Error('Invalid seed phrase'))
                }]}
            >
                <Input addonAfter={<SettingOutlined onClick={newSeedClicked}/>} />
            </Form.Item>
            <Form.Item
                label="Password"
                tooltip=""
                name="password"
                rules={[
                    { required: true, message: 'Please input your password!' },
                    { min: 5, message: 'password must be minimum 5 characters.' },
                ]}
            >
                <Input.Password />
            </Form.Item>
            <Form.Item
                label="Repeat"
                tooltip=""
                name="password2"
                rules={[
                    { required: true, message: 'Please input your password!' },
                    { min: 5, message: 'password must be minimum 5 characters.' },
                    ({ getFieldValue }) => ({
                        validator(_, value) {
                            if (!value || getFieldValue('password') === value) {
                                return Promise.resolve();
                            }

                            return Promise.reject(new Error('The passwords do not match!'));
                        },
                    }),
                  ]}
            >
                <Input.Password />
            </Form.Item>

            <Form.Item
                label=""
                tooltip=""
                name="verifyWrittenDown"
                valuePropName="checked"
                rules={[
                    {
                    validator: (_, value) =>
                    value ? Promise.resolve() : Promise.reject(new Error('You should write down your seed and then proceed'))
                }]}
            >
                <Checkbox>I have written down my seed phrase</Checkbox>
            </Form.Item>

            <Button type="primary" htmlType="submit">
                Accept
            </Button>
        </Form>
    </>
    } />;
});

export default WalletSetup;

