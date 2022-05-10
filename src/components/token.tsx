import * as React from 'react';
import { useState } from 'react';
import { useStore } from '../stores';
import { observer } from 'mobx-react';
import { formatAmount } from '../utils';
import { SwapOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';

export interface TokenComponentProps {
    amount: number;
}

const TokenComponent = observer((props: TokenComponentProps) => {
    const { utxos } = useStore();
    const [ type, setType ] = useState(0);

    let strValue, tooltip: string;

    const update = (amount: number) => {
        if (type === 0) {
            strValue = formatAmount(amount);
            tooltip = `$ ${formatAmount(amount * utxos.priceInEOS, ' ')}`;
        } else {
            strValue = `$ ${formatAmount(amount * utxos.priceInEOS, ' ')}`;
            tooltip = formatAmount(amount);
        }
    }

    update(props.amount);

    const onClick = () => {
        setType((type + 1) % 2);
        update(props.amount);
    }

    return <Tooltip  placement="topLeft" title={tooltip}><span onClick={onClick} style={{cursor: 'pointer', alignContent: 'right'}}>{strValue} <SwapOutlined/></span></Tooltip>
});

export default TokenComponent;