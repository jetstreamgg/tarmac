import React from 'react';
import { Layout } from '../modules/layout/components/Layout';
import { MainApp } from '@/modules/app/components/MainApp';

function Home(): React.ReactElement {
  return (
    <Layout>
      <MainApp />
    </Layout>
  );
}

export default Home;
