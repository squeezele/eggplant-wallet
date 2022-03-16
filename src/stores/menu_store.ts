import { makeAutoObservable } from 'mobx';

export const MenuStore = () => {
	return makeAutoObservable({
		selectedKey: '1',

        setSelectedKey(key: string) {
            this.selectedKey = key;
        }
	}
);

};
