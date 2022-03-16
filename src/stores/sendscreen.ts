import { makeAutoObservable } from 'mobx';

export const SendScreenStore = () => {
	return makeAutoObservable({
		selectedUTXORows: [] as number[],
        feesRequired: 0.0,
        totalAmountSelected: 0.0,

        setRows(rows: number[]) {
            this.selectedUTXORows = rows;
        },

        setTotalAmountSelected(amount: number) {
            this.totalAmountSelected = amount;
        },

        setFeesRequired(f: number) {
            this.feesRequired = f;
        }
	}
);

};
