
import * as React from 'react';
import { useStore } from '../stores';
import { observer } from 'mobx-react';
import { Form, Table, Button, Input, Row, Col, Modal, Result } from 'antd';
import { AlignType } from 'rc-table/lib/interface';
import { shortAddress, formatAmount, fixBufferEndianForEOS } from '../utils';
import { IUTXOInput } from '../stores/eosaccounts_store';
import { Serialize } from 'eosjs';
import { PublicKey } from 'eosjs/dist/eosjs-key-conversions';
import { Signature } from 'anchor-link';
import sha256 from 'fast-sha256';
import { gConn, IActionSubmitResult } from '../rt';
import TokenComponent from './token';
import { UTXO } from '../stores/utxo_store';

const makeTransferWithFees = async (
    formData: ISendFormData, 
    eosAccounts: any,
    utxos: any,
    sendScreen: any
) => {
    const output = {
        pk: formData.address,
        account: '',
        quantity: formatAmount(formData.amount)
    }

    try {
        PublicKey.fromString(output.pk);
    } catch (e: any) {
        output.account = output.pk;
        output.pk = 'EOS7AoqMPRLs6wrZArgUvaVEytpwxovZtpP8PwahXjWVoCPsBHw1r';
    }

    const outputs = [output];

    const change = sendScreen.totalAmountSelected - formData.amount - formData.fee;
    if (change > 0) {
        const changeUTXO = utxos.create_receive_address(`change for ${formData.address}`)
        await gConn.getUTXOs([changeUTXO.pk]);
        
        outputs.push({
            pk: changeUTXO.pk,
            account: '',
            quantity: formatAmount(change),
        })
    }

    const buf = new Serialize.SerialBuffer();
    buf.pushArray([outputs.length]);
    for (const o of outputs) {
        buf.pushPublicKey(o.pk);
        buf.pushName(o.account);
        buf.pushAsset(o.quantity);
    }

    const outputDigest = fixBufferEndianForEOS(sha256(buf.asUint8Array())).asUint8Array();

    const inputs = [] as IUTXOInput[];
    sendScreen.selectedUTXORows.map((row: any) => {
        const utxo = utxos.getById(row);
        const buf = new Serialize.SerialBuffer();
        buf.pushNumberAsUint64(utxo.id);
        buf.pushArray(outputDigest);

        const digest = sha256(buf.asUint8Array());
        const privateKey = utxo.private_key;

        const sig = privateKey.sign(digest, false, 'binary').toString();
        const sigString = Signature.from(sig).toString();

        inputs.push({
            id: utxo.id,
            sig: sigString,
        });
    });

    const action = eosAccounts.makeTransferAction(inputs, outputs, '');
    return action;
}

const UTXOTable = observer(() => {
    const { utxos, sendScreen } = useStore();

    const onSelectChange = async (newSelectedRowKeys: number[]) => {
        sendScreen.setRows( newSelectedRowKeys );

        let totalInputAmount = 0.0;
        sendScreen.selectedUTXORows.map(row=>{
            const utxo: UTXO = utxos.getById(row);
            totalInputAmount += utxo.amount;
        });

        sendScreen.setTotalAmountSelected(totalInputAmount);
    };

    const rowSelection = {
        selectedUTXORows: sendScreen.selectedUTXORows,
        onChange: onSelectChange,
    };

    const columns = [
        {
            title: 'Address',
            dataIndex: 'pk',
            key: 'pk',
            render: (a: string): string => shortAddress(a, 11),
        },
        {
            title: 'Balance',
            dataIndex: 'amount',
            key: 'amount',
            className: 'column-money',
            align: 'right' as AlignType,
            render: (b: number): string => formatAmount(b),
        },
        // {
        //     title: 'Privacy',
        //     dataIndex: 'unonymity_set',
        //     key: 'unonymity_set',
        // },
        {
            title: 'Private Comments',
            dataIndex: 'comment',
            key: 'comment',
            ellipsis: true,
        },
    ];

    return (
        <div style={{height:"270px"}}>
            <Table
                size="small"
                rowKey="id"
                rowSelection={rowSelection}
                columns={columns}
                dataSource={[...utxos.nonZero]}
                pagination={{ defaultPageSize: 5 }}/>
        </div>
    );
});

interface ISendFormData {
    address: string;
    amount: number;
    fee: number;
}

const PEOSSend = observer(() => {
    const { utxos, sendScreen, eosAccounts } = useStore();
    const [ form ] = Form.useForm();
    const [ showSuccessModal, setShowSuccessModal ] = React.useState(false);
    const [ showErrorModal, setShowErrorModal ] = React.useState(false);
    const [ sendResult, setSendResult ] = React.useState({} as IActionSubmitResult);

    

    const onSubmit = async (data: any) => {
        const formData:  ISendFormData = {
            address: data.address,
            amount: parseFloat(data.amount),
            fee: 0,
        }

        const action = await makeTransferWithFees(formData, eosAccounts, utxos, sendScreen);
        const { user_fee, required_fee } = await gConn.validateAction(action);
        // If we created a change address remove it
        if (action.data.outputs.length > 1) {
            const u = utxos.drop_last_receive_address();
            await gConn.stopListenUTXOs([u.pk]);
        }

        formData.fee = required_fee;
        const finalAction = await makeTransferWithFees(formData, eosAccounts, utxos, sendScreen);
        await gConn.validateAction(finalAction);

        const res = await eosAccounts.transfer(finalAction);
        if(res.error) {
            const u = utxos.drop_last_receive_address();
            await gConn.stopListenUTXOs([u.pk]);
            console.log('error', res);
            setShowErrorModal(true);
            return;
        }

        form.resetFields();
        sendScreen.setRows([]);
        sendScreen.setTotalAmountSelected(0);
        sendScreen.setFeesRequired(0);

        console.log('success:', res);
        setSendResult(res);
        setShowSuccessModal(true);
    }

    const onFieldsChange = async (changedFields: any, allFields: any) => {
        if (changedFields.length === 0) {
            return;
        }

        let address, amount: string;

        for(let i in allFields) {
            const f = allFields[i];
            // console.log(f);
            // if (f.errors.length > 0) {
            //     return;
            // }
            if (f.name[0] === 'address') address = f.value;
            else if (f.name[0] === 'amount') amount = f.value;
        }

        if (!address || !amount) {
            return;
        }

        const formData: ISendFormData = {
            address: address,
            amount: parseFloat(amount),
            fee: sendScreen.feesRequired,
        }

        const { user_fee } = await gConn.costAction(sendScreen.selectedUTXORows, formData.amount);

        if (sendScreen.feesRequired !== user_fee) {
            sendScreen.setFeesRequired(user_fee);
            form.validateFields();
        }
    }

    return (
        <div>
            <h2>1. Select coins to spend</h2>
            <UTXOTable/>

            <Form
                name="send_form"
                form={form}
                onFinish={onSubmit}
                layout="vertical"
                requiredMark={false}
                onFieldsChange={onFieldsChange}
            >
                <Row gutter={[32, 32]}>
                    <Col span={13}>
                        <h2>2. Fill address and amount</h2>
                        <div style={{ textAlign:'right'}}>
                            Total selected coins: <b><TokenComponent amount={sendScreen.totalAmountSelected}/></b><br/>
                        </div>
                        <Form.Item
                            label="Recipient address"
                            tooltip="Recipient PEOS address or an EOS account"
                            name="address"
                            rules={[{ required: true, message: 'Recipient address is required' },]}
                        >
                            <Input />
                        </Form.Item>

                        <Form.Item
                            label="Amount"
                            tooltip="Amount to send. Must be less or equal to the selected coins above."
                            name="amount"
                            rules={[
                                {
                                    validator: (_, value) => parseFloat(value) <= (sendScreen.totalAmountSelected - sendScreen.feesRequired) ? Promise.resolve() : Promise.reject(new Error('Total selected coins are less than amount to send'))
                                },
                                {
                                    validator: (_, value) =>
                                        parseFloat(value) > 0 ? Promise.resolve() : Promise.reject(new Error('Amount should be greated than zero'))
                                },
                            ]}
                            style={{margin:'0px 0px 0px 0px'}}
                        >
                            <Input type="number"/>
                        </Form.Item>
                        <div style={{ textAlign:'right' }}>
                            Transaction fees: <b><TokenComponent amount={sendScreen.feesRequired}/></b>
                        </div>
                    </Col>
                    <Col span={11}>
                        <h2>3. Send!</h2>
                        <Button type="primary" htmlType="submit" style={{width: 128}}>
                            Send
                        </Button>
                    </Col>
                </Row>
            </Form>
            <Modal
                title={null}
                centered
                footer={null}
                visible={showSuccessModal}
                onOk={() => setShowSuccessModal(false)}
                onCancel={() => setShowSuccessModal(false)}
                >
                <Result
                    status="success"
                    title="Transfer successful!"
                    subTitle={`Transaction id: ${sendResult.transactionId}`}
                    extra={[
                        <Button type="primary" key="close" onClick={()=>setShowSuccessModal(false)}>
                            Dismiss
                        </Button>
                    ]}
                />
            </Modal>
            <Modal
                title={null}
                centered
                footer={null}
                visible={showErrorModal}
                onOk={() => setShowErrorModal(false)}
                onCancel={() => setShowErrorModal(false)}
                >
                <Result
                    status="error"
                    title="Transfer failed!"
                    subTitle={`Transaction id: <a href="https://www.bloks.io/transaction/${sendResult.transactionId}">${sendResult.transactionId}</a>`}
                    extra={[
                        <Button type="primary" key="close" onClick={()=>setShowErrorModal(false)}>
                            Dismiss
                        </Button>
                    ]}
                />
            </Modal>
        </div>
    );
});

export default PEOSSend;
