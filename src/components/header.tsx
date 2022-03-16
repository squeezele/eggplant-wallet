import * as React from 'react';
import { useStore } from '../stores';
import { observer } from 'mobx-react';
import { Layout, Tabs, Affix } from 'antd';

const { Header, Content, Footer, Sider } = Layout;

const HeaderComponent = observer(() => {
    const { utxos } = useStore();

    return (
    <>
        <Header className="header">
            <div className="logo" />
        </Header>
    </>)
});

export default HeaderComponent;