import { createDbWorker, type WorkerHttpvfs } from "sql.js-httpvfs";
import workerUrl from "sql.js-httpvfs/dist/sqlite.worker.js?url";
import wasmUrl from "sql.js-httpvfs/dist/sql-wasm.wasm?url";

export type DbWorker = WorkerHttpvfs;

export function openDatabase(): Promise<DbWorker> {
	const configUrl = `${import.meta.env.BASE_URL}db/config.json`;
	return createDbWorker([{ from: "jsonconfig", configUrl }], workerUrl, wasmUrl);
}
