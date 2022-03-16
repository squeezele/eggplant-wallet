import { createContext, useContext } from 'react';
import { EOSAccountsStore } from './eosaccounts_store';
import { UTXOStore } from './utxo_store';
import { SendScreenStore } from './sendscreen';
import { MenuStore } from './menu_store';

const store = {
	utxos: UTXOStore('seed me please'),
    eosAccounts: EOSAccountsStore(),
    sendScreen: SendScreenStore(),
    menu: MenuStore(),
}

export const StoreContext = createContext(store);

export const useStore = () : typeof store => {
	return useContext(StoreContext) as typeof store;
}

export default store;
