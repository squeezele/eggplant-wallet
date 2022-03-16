import * as demux from 'websocket-demux';
import * as WebSocket from 'ws';
import { UTXO } from './stores/utxo_store';
import { IActionValidationResult, IActionCostResult } from './eosdefs';
import { getAmount } from './utils';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Message {}

interface UpdateUTXOMessage {
    cmd: string;
    utxo: string;
}

export interface IActionSubmitResult {
    error?: number;
    msg?: string;
    transactionId?: string;
}

demux.init();

export const Connection = (_address: string): any => {
    let wss: WebSocket.WebSocket;
    const address = _address;
    let utxos: any;

    return {
        connect: async (_utxos: any): Promise<void> => {
            utxos = _utxos;
            const handleMessage = (msg: Message): void => {
                if(demux.process_message(msg)) {
                    return;
                }

                const update = msg as UpdateUTXOMessage;

                switch (update.cmd) {
                    case 'updated_utxo':
                        utxos.updateUTXO(update.utxo);
                        break;
                }
                return;
            };

            await utxos.load();

            return new Promise((resolve, reject) => {
                const _wss = new WebSocket.WebSocket(address);
                _wss.onopen = async (event: WebSocket.Event): Promise<void> => {
                    console.log('onopen', event);
                    await utxos.syncWithBlockchain();
                    resolve();
                };
                _wss.onclose = (event: WebSocket.Event): void => {
                    console.log('onclose', event);
                    demux.socket_closed();

                    setTimeout(()=>{
                        gConn.connect(utxos);
                    }, 2000);
                };
                _wss.onmessage = (event: WebSocket.MessageEvent): void => {
                    if (typeof event.data !== 'string') {
                        return;
                    }

                    const payload = JSON.parse(event.data);
                    handleMessage(payload);
                };
                _wss.onerror = (event: WebSocket.ErrorEvent): void => {
                    console.log('onerror', event);
                    reject(event);
                };

                wss = _wss;
            });
        },

        getUTXOs: async (pks: string[]): Promise<UTXO[]> => {
            const res = await demux.request_async(wss, {
                cmd: 'listen_utxos',
                utxos: pks,
            });

            const utxos = res.payload.utxos;

            utxos.map((utxo: any) => {
                utxo.hd_index = 0;
                utxo.unonymity_set = 0;
                utxo.private_key = '';
                utxo.comment = '';
                utxo.amount = getAmount(utxo.amount);
            })

            return utxos as UTXO[];
        },

        stopListenUTXOs: async (pks: string[]): Promise<void> => {
            await demux.request_async(wss, {
                cmd: 'stop_listen_utxos',
                utxos: pks,
            });
        },

        costAction: async (inputs: number[], amount: number): Promise<IActionCostResult> => {
            const res = await demux.request_async(wss, {
                cmd: 'cost_action',
                inputs,
                amount
            });

            const valRes = res.payload as IActionCostResult;
            return valRes
        },

        validateAction: async (action: any): Promise<IActionValidationResult> => {
            const res = await demux.request_async(wss, {
                cmd: 'validate_action',
                action,
            });

            const valRes = res.payload as IActionValidationResult;
            return valRes
        },

        broadcastAction: async (action: any): Promise<IActionSubmitResult> => {
            const res = await demux.request_async(wss, {
                cmd: 'transmit_action',
                action,
            });

            const payload = res.payload;

            if (payload.error) {
                return {
                    error: payload.error.code,
                    msg: payload.error.details ? payload.error.details[0].message : ''
                }
            }

            const valRes = { transactionId: payload.result.transaction_id } as IActionSubmitResult;
            return valRes
        }
    };
};

const addr = '168.100.8.137';
//const addr = '127.0.0.1';
export const gConn = Connection(`ws://${addr}:4444`);
