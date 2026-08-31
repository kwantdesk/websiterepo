#!/usr/bin/env python3
"""Held-out 10:00 ET reconciliation of Trinity against owned OPRA/QuantData data.

This is a research harness, not product code.  It deliberately trains only on
09:30-09:55 snapshots and reports 10:00 as an untouched holdout.  The goal is
to identify which state transition is supported by the data instead of fitting
one attractive strike after seeing the answer.
"""

from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.ensemble import ExtraTreesRegressor, GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


ROOT = Path(__file__).resolve().parents[1]
FULL_TARGETS = Path(r"C:\Users\Karen\AppData\Local\Temp\trinity-full-lattices-2026-08-21.json")
EXTRA_TARGETS = ROOT / "scripts" / "trinity-extra-lattices-2026-08-21.json"
INTERVAL_MAP = ROOT / "tmp" / "quantdata-interval-map-2026-08-21.json"
TAPE = ROOT / "tmp" / "trinity-inventory-tape-2026-08-17-to-2026-08-21.json"
OUTPUT = ROOT / "tmp" / "trinity-transition-models-2026-08-21.json"

SYMBOLS = ("SPXW", "SPY", "QQQ")
DATA_SYMBOL = {"SPXW": "SPX", "SPY": "SPY", "QQQ": "QQQ"}
SCALE_STRIKE = {"SPXW": 100.0, "SPY": 10.0, "QQQ": 10.0}
CENTRE_STRIKE = {"SPXW": 7665.0, "SPY": 764.0, "QQQ": 712.0}
EXPIRY = "2026-08-21"
TIMES = {
    "0930": 1787319000000,
    "0935": 1787319300000,
    "0940": 1787319600000,
    "0945": 1787319900000,
    "0950": 1787320200000,
    "0955": 1787320500000,
    "1000": 1787320800000,
}
ORDER = tuple(TIMES)


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def rows_to_map(rows):
    if isinstance(rows, dict):
        return {float(strike): float(value) for strike, value in rows.items()}
    return {float(row["strike"]): float(row["value"]) for row in rows}


def load_targets():
    full = read_json(FULL_TARGETS)
    extra = read_json(EXTRA_TARGETS)
    targets = defaultdict(dict)
    for source, label in (("930", "0930"), ("945", "0945"), ("1000", "1000")):
        for symbol in SYMBOLS:
            source_symbol = DATA_SYMBOL[symbol] if symbol == "SPXW" else symbol
            targets[(label, symbol)] = rows_to_map(full["targets"][source][source_symbol])
    labels = {"09:35:00": "0935", "09:40:00": "0940", "09:50:00": "0950", "09:55:00": "0955"}
    for timestamp, panels in extra.items():
        label = labels.get(timestamp[11:19])
        if not label:
            continue
        for symbol in SYMBOLS:
            targets[(label, symbol)] = rows_to_map(panels[symbol]["values"])
    return targets


def cell(frame, strike):
    bucket = frame.get(EXPIRY, {})
    value = bucket.get(f"{strike:.1f}", bucket.get(str(int(strike)), {}))
    return float(value.get("CALL", 0.0)), float(value.get("PUT", 0.0))


def nearest_frame(frames, timestamp):
    eligible = [key for key in frames if int(key) <= timestamp + 1000]
    return frames[max(eligible, key=int)] if eligible else {}


def tape_bucket(trade):
    prefix = "C" if trade.get("type") == "CALL" else "P" if trade.get("type") == "PUT" else ""
    suffix = "B" if trade.get("side") == "BUY" else "S" if trade.get("side") == "SELL" else "M"
    return prefix + suffix if prefix else ""


def build_flow_index(tape):
    by_key = defaultdict(list)
    for symbol in SYMBOLS:
        for trade in tape.get(DATA_SYMBOL[symbol], []):
            if trade.get("expiration") != EXPIRY:
                continue
            timestamp = int(trade.get("timestamp", 0))
            if timestamp < TIMES["0930"] or timestamp > TIMES["1000"]:
                continue
            bucket = tape_bucket(trade)
            if not bucket:
                continue
            by_key[(symbol, float(trade["strike"]))].append((timestamp, bucket, float(trade.get("size", 0.0))))
    return by_key


def transition_flows(flow_index, symbol, strike, start, end):
    result = {key: 0.0 for key in ("CB", "CS", "CM", "PB", "PS", "PM")}
    for timestamp, bucket, size in flow_index.get((symbol, strike), ()):
        if start < timestamp <= end:
            result[bucket] += size
    return result


def build_rows():
    targets = load_targets()
    interval = read_json(INTERVAL_MAP)
    flow_index = build_flow_index(read_json(TAPE))
    rows = []
    for index in range(1, len(ORDER)):
        previous_label, label = ORDER[index - 1], ORDER[index]
        previous_time, timestamp = TIMES[previous_label], TIMES[label]
        for symbol in SYMBOLS:
            previous_targets = targets[(previous_label, symbol)]
            current_targets = targets[(label, symbol)]
            frames = interval[DATA_SYMBOL[symbol]]["data"]
            previous_frame = nearest_frame(frames, previous_time)
            current_frame = nearest_frame(frames, timestamp)
            for strike in sorted(set(previous_targets) & set(current_targets)):
                call0, put0 = cell(previous_frame, strike)
                call1, put1 = cell(current_frame, strike)
                flows = transition_flows(flow_index, symbol, strike, previous_time, timestamp)
                target0 = previous_targets[strike]
                target1 = current_targets[strike]
                gross0 = abs(call0) + abs(put0)
                gross1 = abs(call1) + abs(put1)
                net0 = call0 + put0
                net1 = call1 + put1
                row = {
                    "symbol": symbol,
                    "strike": strike,
                    "previous_label": previous_label,
                    "label": label,
                    "target0": target0,
                    "target": target1,
                    "delta_target": target1 - target0,
                    "call0": call0,
                    "put0": put0,
                    "call": call1,
                    "put": put1,
                    "delta_call": call1 - call0,
                    "delta_put": put1 - put0,
                    "net0": net0,
                    "net": net1,
                    "delta_net": net1 - net0,
                    "gross0": gross0,
                    "gross": gross1,
                    "delta_gross": gross1 - gross0,
                    "gross_ratio": gross1 / gross0 if gross0 else 1.0,
                    "net_ratio": net1 / net0 if abs(net0) > 1e-9 else 1.0,
                    "moneyness": (strike - CENTRE_STRIKE[symbol]) / SCALE_STRIKE[symbol],
                    "is_spxw": float(symbol == "SPXW"),
                    "is_spy": float(symbol == "SPY"),
                    "is_qqq": float(symbol == "QQQ"),
                    **flows,
                }
                row["signed_contract_flow"] = -flows["CB"] + flows["CS"] - 0.25 * flows["CM"] - flows["PB"] + flows["PS"] - 0.25 * flows["PM"]
                row["call_contract_flow"] = -flows["CB"] + flows["CS"] - 0.25 * flows["CM"]
                row["put_contract_flow"] = -flows["PB"] + flows["PS"] - 0.25 * flows["PM"]
                rows.append(row)
    return rows


def metrics(actual, predicted):
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    return {
        "n": int(actual.size),
        "rmse": float(math.sqrt(mean_squared_error(actual, predicted))),
        "mae": float(mean_absolute_error(actual, predicted)),
        "r2": float(r2_score(actual, predicted)),
        "sign": float(np.mean(np.sign(actual) == np.sign(predicted))),
    }


def evaluate_models(rows):
    feature_names = [
        "target0", "call0", "put0", "call", "put", "delta_call", "delta_put",
        "net0", "net", "delta_net", "gross0", "gross", "delta_gross",
        "gross_ratio", "net_ratio", "moneyness", "is_spxw", "is_spy", "is_qqq",
        "CB", "CS", "CM", "PB", "PS", "PM", "signed_contract_flow",
        "call_contract_flow", "put_contract_flow",
    ]
    train = [row for row in rows if row["label"] != "1000"]
    test = [row for row in rows if row["label"] == "1000"]
    x_train = np.asarray([[row[key] for key in feature_names] for row in train], dtype=float)
    x_test = np.asarray([[row[key] for key in feature_names] for row in test], dtype=float)
    y_train_delta = np.asarray([row["delta_target"] for row in train])
    y_test = np.asarray([row["target"] for row in test])
    persistence = np.asarray([row["target0"] for row in test])

    models = {
        "ridge_1": make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
        "ridge_100": make_pipeline(StandardScaler(), Ridge(alpha=100.0)),
        "gradient_boosting": GradientBoostingRegressor(n_estimators=300, learning_rate=0.025, max_depth=2, loss="huber", random_state=7),
        "random_forest": RandomForestRegressor(n_estimators=500, min_samples_leaf=4, max_features=0.8, n_jobs=-1, random_state=7),
        "extra_trees": ExtraTreesRegressor(n_estimators=500, min_samples_leaf=3, max_features=0.9, n_jobs=-1, random_state=7),
    }
    results = {"persistence": metrics(y_test, persistence)}
    predictions = {}
    for name, model in models.items():
        model.fit(x_train, y_train_delta)
        predicted = persistence + model.predict(x_test)
        results[name] = metrics(y_test, predicted)
        predictions[name] = predicted

    simple = {
        "gross_reprice": np.asarray([row["target0"] * np.clip(row["gross_ratio"], 0.25, 4.0) for row in test]),
        "net_reprice": np.asarray([row["target0"] * np.clip(row["net_ratio"], -4.0, 4.0) for row in test]),
    }
    for name, predicted in simple.items():
        results[name] = metrics(y_test, predicted)
        predictions[name] = predicted

    best_name = min((name for name in results if name != "persistence"), key=lambda name: results[name]["rmse"])
    best_predictions = predictions[best_name]
    largest = []
    for row, predicted, baseline in sorted(zip(test, best_predictions, persistence), key=lambda item: abs(item[0]["target"]), reverse=True)[:40]:
        largest.append({
            "symbol": row["symbol"], "strike": row["strike"], "target": row["target"],
            "predicted": float(predicted), "persistence": float(baseline),
            "error": float(predicted - row["target"]),
        })
    return feature_names, results, best_name, largest


def main():
    rows = build_rows()
    features, results, best_name, largest = evaluate_models(rows)
    payload = {"features": features, "results": results, "best": best_name, "largest": largest}
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("Trinity transition models; 10:00 ET is untouched")
    for name, result in sorted(results.items(), key=lambda item: item[1]["rmse"]):
        print(f"{name:20s} RMSE ${result['rmse']/1e6:7.3f}M  R2 {result['r2']:8.5f}  sign {result['sign']:.3f}")
    print(f"\nBest non-persistence model: {best_name}")
    for row in largest[:24]:
        print(
            f"{row['symbol']:4s} {row['strike']:7g}  target {row['target']/1e6:+9.3f}M  "
            f"model {row['predicted']/1e6:+9.3f}M  prior {row['persistence']/1e6:+9.3f}M"
        )


if __name__ == "__main__":
    main()
