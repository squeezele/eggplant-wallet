
import * as React from 'react';
import { useStore } from '../stores';
import { observer } from 'mobx-react';
import { Statistic, Row, Space, Divider, Button } from 'antd';
import { formatAmount } from '../utils';
import TokenComponent from './token';


const PEOSWallet = observer(() => {
    const { utxos, menu } = useStore();

    return (
        <>
        <Divider orientation="left">Wallet information</Divider>
        <Row justify="center">
            <Space size="large">
            <Statistic
                style={{width: '250px'}}
                title='Balance'
                valueRender={()=><TokenComponent amount={utxos.totalAmount}/>}
            />
            <Statistic 
                title="UTXOs"
                value={utxos.nonZero.length}
            />
            <Statistic 
                title="Addresses"
                value={utxos.HDIndex}
            />
            
            </Space>
        </Row>
        <Divider/>
        <Divider orientation="left">Wallet actions</Divider>
        <Row justify="center">
            <Space size="large">
                <Button 
                    size="large" 
                    type="primary" 
                    style={{width:"200px"}}
                    onClick={()=>menu.setSelectedKey('2')}
                >Send</Button>
                <Button 
                    size="large" 
                    type="primary" 
                    style={{width:"200px"}}
                    onClick={()=>menu.setSelectedKey('3')}
                >Receive</Button>
            </Space>
        </Row>
        <Divider/>
        </>    
    );
});

export default PEOSWallet;
