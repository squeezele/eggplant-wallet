import * as React from 'react';
import { useStore } from '../stores';
import { observer } from 'mobx-react';
import { UTXO } from '../stores/utxo_store';
import { Button, Table } from 'antd';
import { gConn } from '../rt';

const PEOSReceive = observer(() => {
    const { utxos } = useStore();

    const rUTXO = [] as UTXO[];

    utxos.activeReceiveAddresses.map(hdIndex => {
        rUTXO.push(utxos.getByHDIndex(hdIndex));
    });

    const columns = [
        {
            title: '#',
            dataIndex: 'hd_index',
            key: 'hd_index',
            width: 48,
        },
        {
            title: 'Address',
            dataIndex: 'pk',
            key: 'pk',
            width: 480,
        },
        {
            title: 'Private Comments',
            dataIndex: 'comment',
            key: 'comment',
            ellipsis: true,
        },
    ];

    const onClick = async () => {
        const u = utxos.create_receive_address('');
        const bUTXO = await gConn.getUTXOs([u.pk]);

        if (bUTXO.length > 0) {
            bUTXO.forEach(async (utxo: any)=> await utxos.updateUTXO(utxo));
        }
    };

    return <>
        <Table rowKey="hd_index" columns={columns} dataSource={[...rUTXO]} pagination={{ defaultPageSize: 5 }} />
        <Button type="primary" onClick={onClick}>Create new receive address</Button>
    </>;
});

export default PEOSReceive;
