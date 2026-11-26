"""Evaluate only whitelisted arithmetic from read-only PHP source; never include/connect it."""
import argparse
import base64
import csv
import io
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
LEGACY = ROOT.parent / "inpatient"
OUT = ROOT / "docs/screenshots/parity-phase-3/legacy-result.json"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--php", required=True)
    args = parser.parse_args()
    source = (LEGACY / "insert_data.php").read_text(encoding="utf-8-sig")
    snippets = re.findall(r"^\s*(\$(?:total_paid_(?:pt|nb)|result_(?:pt|nb))\s*=[^;]+;)", source, re.M)
    assert len(snippets) == 4
    arithmetic = "\n".join(snippets)
    assert re.fullmatch(r"[\s$a-z_'\[\]+=;\-]+", arithmetic), "Unexpected source: refuse execution"
    fixture = (ROOT / "docs/parity-fixtures-phase-1.md").read_text(encoding="utf-8")
    rows = list(csv.DictReader(io.StringIO(re.search(r"```csv\n(.*?)```", fixture, re.S)[1])))
    expected = [(10, 2)]*3 + [(6, 1)]*3 + [(12, 3), (11, 2), (10, 1), (6, 1), (5, 1), (10, 1), (10, 1)]
    data = []
    for row in rows:
        values = dict.fromkeys([f"{suffix}_{group}" for group in ("pt", "nb") for suffix in ("on", "in", "move", "home", "move_b", "send", "dead", "non_voluntary", "ad")], 0)
        values.update({key: int(value) for key, value in row.items() if key.endswith(("_pt", "_nb"))})
        data.append(values)
    encoded = base64.b64encode(json.dumps(data).encode()).decode()
    # Arithmetic is validated above. No include, SQL, network, or execution of application pages.
    program = "<?php\n$rows=json_decode(base64_decode('"+encoded+"'),true);$out=[];foreach($rows as $r){\n"+arithmetic+"\n$out[]=[$result_pt,$result_nb];}echo json_encode($out);"
    completed = subprocess.run([args.php], input=program, text=True, capture_output=True, check=True)
    results = json.loads(completed.stdout)
    assert results == [list(pair) for pair in expected]
    manage = (LEGACY / "manage_data.php").read_text(encoding="utf-8-sig")
    news = (LEGACY / "news_save.php").read_text(encoding="utf-8-sig")
    confirm = (LEGACY / "confirm_data_save.php").read_text(encoding="utf-8-sig")
    returned = (LEGACY / "return_save.php").read_text(encoding="utf-8-sig")
    contracts = {
        "carry_forward_date_lte_not_prior_shift": "idate <= '$idate2' ORDER BY idate DESC, wage_type_id DESC" in source,
        "confirmation_status_and_actual_session_actor": "i_status = 1" in confirm and "data_confirm" in confirm and "$_SESSION[sess_uinid]" in confirm,
        "return_status_zero_without_reason": "i_status = 0" in returned and "reason" not in returned,
        "news_insert_and_edit_store_actual_session_login": news.count("$_SESSION[sess_uinid]") == 2,
        "raw_blank_not_normalized_before_sql": "$on_pt = $_POST['on_pt'];" in manage,
        "gyn_normal_post_key_typo": "$gyn_n = $_POST['gyn_ n'];" in manage,
        "gyn_special_post_key_typo": "$gyn_s = $_POST['gys_s'];" in manage,
        "insert_skin_normal_uses_special": "'$psych_n', '$skin_s', '$ped_n'" in manage,
        "edit_skin_normal_uses_normal": "skin_n = '$skin_n'" in manage,
        "monthly_key_and_replace": "substr($idate, 0, 7)" in manage and "REPLACE INTO readmit" in manage,
        "afternoon_supplements_branch": 'if ($wage_type == "3")' in manage and "REPLACE INTO pressure" in manage,
    }
    assert all(contracts.values()), contracts
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(dict(passed=True, php_arithmetic_cases=[dict(id=row["id"], pt=pair[0], nb=pair[1]) for row,pair in zip(rows,results)], source_contracts=contracts,
        limits="PHP arithmetic only plus source assertions. No legacy PHP page, session, MySQL query, or blank coercion executed."), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"PASS {len(results)} source-extracted PHP arithmetic cases; {len(contracts)} source contracts. No legacy database connection.")


if __name__ == "__main__":
    main()
