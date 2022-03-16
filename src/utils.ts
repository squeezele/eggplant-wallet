import { Serialize } from 'eosjs';
import cryptojs from 'crypto-js';

export const formatAmount = (asset: number, symbol?: string) => `${asset.toFixed(4)} ${symbol || 'PEOS'}`
export const getAmount = (balance: string): number => typeof balance === 'string' ? parseFloat(balance.split(' ')[0]) : balance;
export const shortAddress = (address: string, length: number = 10): string => `${address.slice(0, length)}...${address.slice(address.length - length, address.length)}`;

export const fixBufferEndianForEOS = (buf: any): Serialize.SerialBuffer => {
    const ret = new Serialize.SerialBuffer();
    // const data = buf.asUint8Array();

    for(let i = 15 ; i >= 0 ; --i) {
        ret.pushArray([buf[i]]);
    }

    for(let i = 31 ; i >= 16 ; --i) {
        ret.pushArray([buf[i]]);
    }

    return ret;
}

const KEY_SIZE = 256;

export const encrypt = (data: string, pass: string, iterations = 4500): string => {
    const salt = cryptojs.lib.WordArray.random(128 / 8);
    const key = cryptojs.PBKDF2(pass, salt, {
        iterations,
        keySize: KEY_SIZE / 4
    });
    const iv = cryptojs.lib.WordArray.random(128 / 8);
    const encrypted = cryptojs.AES.encrypt(data, key, {
        iv,
        mode: cryptojs.mode.CBC,
        padding: cryptojs.pad.Pkcs7
    });
    return salt.toString() + iv.toString() + encrypted.toString();
  }

  export const decrypt = (data: string, pass: string, iterations = 4500) => {
    const salt = cryptojs.enc.Hex.parse(data.substr(0, 32));
    const iv = cryptojs.enc.Hex.parse(data.substr(32, 32));
    const encrypted = data.substring(64);
    const key = cryptojs.PBKDF2(pass, salt, {
        iterations,
        keySize: KEY_SIZE / 4
    });
    const decrypted = cryptojs.AES.decrypt(encrypted, key, {
        iv,
        padding: cryptojs.pad.Pkcs7,
        mode: cryptojs.mode.CBC
    })

    try {
        return decrypted.toString(cryptojs.enc.Utf8);
    } catch (e) {
        return undefined;
    }
}

export const delay = (ms: number): Promise<boolean> => {
    return new Promise((resolve) => {
        setTimeout(() => resolve(true), ms);
    });
}
