import * as React from 'react';
import { observer } from 'mobx-react';
import { Layout } from 'antd';

const { Content } = Layout;

type Props = {
    inner?: React.ReactNode;
};

const FullscreenComponent = observer((props: Props) => {
    console.log(props);
    return <Layout style={{ minHeight: '100vh' }}>        
        <Layout className="site-layout">
            <Content className="app-bg" style={{ padding: '25px 50px' }}>
                <Layout className="app-bg" style={{ padding: '24px 0' }}>
                    {props.inner}
               </Layout>
            </Content>
        </Layout>
    </Layout>
});

export default FullscreenComponent;
// <Content className="app-bg" style={{ padding: '25px 50px' }}></Content>