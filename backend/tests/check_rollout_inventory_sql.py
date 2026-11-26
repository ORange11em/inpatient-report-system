"""Execute inventory SELECTs on an empty isolated MariaDB schema, never caller DB."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[3]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mysql-bin", required=True)
    args = parser.parse_args()
    binaries = Path(args.mysql_bin).resolve()
    work = Path(tempfile.mkdtemp(prefix="hospital-inventory-sql-test-"))
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    password = secrets.token_hex(24)
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    client_config = work / "client.cnf"
    client_config.write_text(f"[client]\nhost=127.0.0.1\nport={port}\nuser=root\npassword={password}\n", encoding="utf-8")
    server = None
    with (work / "private.log").open("w", encoding="utf-8") as log:
        def client(sql, database=None):
            command = [str(binaries / "mysql.exe"), "--defaults-file=" + str(client_config),
                       "--default-character-set=utf8", "--batch", "--raw"]
            if database:
                command.append(database)
            process = subprocess.run(command, input=sql.encode("utf-8"), stdout=subprocess.PIPE,
                                     stderr=log, creationflags=flags)
            if process.returncode:
                raise RuntimeError("Isolated MariaDB query failed; inspect private log")
            return process.stdout.decode("utf-8")

        try:
            setup = subprocess.run([str(binaries / "mysql_install_db.exe"), "--datadir=" + str(work / "data"),
                                    "--port=" + str(port), "--password=" + password, "--silent"],
                                   stdout=log, stderr=log, creationflags=flags)
            if setup.returncode:
                raise RuntimeError("Isolated MariaDB initialization failed")
            server = subprocess.Popen([str(binaries / "mysqld.exe"), "--no-defaults", "--datadir=" + str(work / "data"),
                                       "--basedir=" + str(binaries.parent), "--port=" + str(port), "--bind-address=127.0.0.1", "--console"],
                                      stdout=log, stderr=log, creationflags=flags)
            for _ in range(150):
                try:
                    client("SELECT 1;")
                    break
                except RuntimeError:
                    time.sleep(.1)
            else:
                raise RuntimeError("Isolated MariaDB did not start")
            client("CREATE DATABASE inventory_test CHARACTER SET utf8;")
            dump = (ROOT / "inpatient/db/db_inpatient.sql").read_text(encoding="utf-8-sig")
            tables = ("data_all", "data_confirm", "data_split_patient", "pressure", "readmit", "tb_news", "ward", "wage_type")
            # Extract schema only. No account, password or INSERT statements are copied.
            schema = []
            for table in tables:
                match = re.search(r"CREATE TABLE `" + table + r"` \(.*?\) ENGINE=.*?;", dump, re.S)
                assert match, table
                schema.append(match[0])
            client("SET SESSION sql_mode='';\n" + "\n".join(schema), "inventory_test")
            sql = (ROOT / "new-system/docs/rollout/source-inventory.sql").read_text(encoding="utf-8")
            statements = [part.strip() for part in re.sub(r"--[^\n]*", "", sql).split(";") if part.strip()]
            assert all(re.match(r"SELECT\b", part, re.I) for part in statements)
            raw = client(sql, "inventory_test")
            inventory = [line.split("\t") for line in raw.splitlines() if line.split("\t")[0] in tables[:6]]
            assert len(inventory) == 6 and all(row[1:] == ["0", "NULL", "NULL", "0", "0"] for row in inventory)
            version = client("SELECT VERSION();").splitlines()[-1]
            result = dict(passed=True, synthetic_empty_schema_only=True, source_data_imported=False,
                          database_version=version, select_statements=len(statements),
                          inventory_rows={row[0]: int(row[1]) for row in inventory},
                          hospital_database_tested=False)
            (ROOT / "new-system/docs/rollout/inventory-sql-check.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
            print(f"PASS {len(statements)} read-only inventory statements on isolated MariaDB empty schema")
        finally:
            if server:
                try:
                    subprocess.run([str(binaries / "mysqladmin.exe"), "--defaults-file=" + str(client_config), "shutdown"],
                                   stdout=log, stderr=log, creationflags=flags, timeout=15)
                    server.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    server.terminate()
                    server.wait(timeout=15)


if __name__ == "__main__":
    main()
