import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import { AuthState } from './db.js';

export const useMongoDBAuthState = async () => {
    const writeData = async (data, id) => {
        const str = JSON.stringify(data, BufferJSON.replacer);
        await AuthState.findByIdAndUpdate(id, { data: str }, { upsert: true });
    };

    const readData = async (id) => {
        const doc = await AuthState.findById(id);
        if (doc && doc.data) {
            return JSON.parse(doc.data, BufferJSON.reviver);
        }
        return null;
    };

    const removeData = async (id) => {
        await AuthState.findByIdAndDelete(id);
    };

    const creds = await readData('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(value ? writeData(value, key) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
};
