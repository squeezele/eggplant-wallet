import * as React from 'react';
import { useEffect, useState } from 'react';
import { render } from 'react-dom';
import { MemoryRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react';
import { Layout, Tabs, Menu } from 'antd';
import './app.css';
// import icon from '../../assets/icon.svg';
import store, { StoreContext, useStore } from './stores';
import EOSWallet from './components/eoswallet';
import PEOSWallet from './components/peoswallet';
import PEOSSend from './components/peossend';
import PEOSReceive from './components/peosreceive';
import WalletSetup from './screens/setup';
import WalletUnlock from './screens/unlock';
import HeaderComponent from './components/header';

import {
    ApiOutlined,
    WalletOutlined,
    KeyOutlined,
    SendOutlined,
    UserOutlined,
  } from '@ant-design/icons';
import SubMenu from 'antd/lib/menu/SubMenu';

const { Content, Sider } = Layout;

const SiderComponent = observer(() => {
    const [ collapsed, setCollapsed ] = useState(false);
    const { menu } = useStore();

    const handleClick = (event: any) => {
        menu.setSelectedKey(event.key);
    };

    const onCollapse = (collapsed: boolean) => {
        setCollapsed(collapsed);
    };

    return <Sider collapsible collapsed={collapsed} onCollapse={onCollapse}>
    <div className="logo" />
        <Menu
        onClick={handleClick}
        defaultSelectedKeys={['1']}
        defaultOpenKeys={['sub1']}
        mode="inline"
        theme="dark"
        onChange={()=>console.log('change')}
    >
        <Menu.Item key="1" icon={<WalletOutlined />}>
            Wallet
        </Menu.Item>
        <Menu.Item key="2" icon={<SendOutlined />}>
            Send
        </Menu.Item>
        <Menu.Item key="3" icon={<KeyOutlined />}>
            Receive addresses
        </Menu.Item>
        <SubMenu key="sub1" icon={<ApiOutlined />}  title="Bridge">
            <Menu.Item key="4">EOS</Menu.Item>
            <Menu.Item key="5">Ethereum</Menu.Item>
        </SubMenu>
    </Menu>
    </Sider>
});

const MainComponent = observer(() => {
    const { utxos, menu } = useStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (utxos.isSetup === false) {
            navigate('/setup');
            return;
        }

        if (utxos.isUnlocked === false) {
            navigate('/unlock');
        }
    });

    switch (menu.selectedKey) {
    case '1':
        return <PEOSWallet/>
    case '2':
        return <PEOSSend/>
    case '3':
        return <PEOSReceive/>
    case '4':
        return <EOSWallet/>
    }

    return <b>FAIL</b>
});

const LayoutComponent = observer(() => 
    <Layout style={{ minHeight: '100vh' }}>        
        <SiderComponent />
        <Layout className="site-layout">
            <HeaderComponent />
            <Content className="app-bg" style={{ padding: '25px 50px' }}>
                <Layout className="app-bg" style={{ padding: '24px 0' }}>
               <MainComponent/>
               </Layout>
            </Content>
        </Layout>
    </Layout>
);

const App= () => {
    const { utxos, eosAccounts } = useStore();

    return (
        <Routes>
            <Route path="/" element={<LayoutComponent/>} />
            <Route path="/setup" element={<WalletSetup/>} />
            <Route path="/unlock" element={<WalletUnlock/>} />
        </Routes>
);
}

render(
<StoreContext.Provider value={store}>
    <Layout style={{ minHeight: '100vh' }}>        
        <Layout className="site-layout">
            <Router>
                <App/>
            </Router>
            </Layout>
    </Layout>
    {/* <Affix offsetBottom={0} target={()=>window}>
        <span>Status bar</span>
    </Affix> */}
</StoreContext.Provider>
,document.getElementById('root'));
