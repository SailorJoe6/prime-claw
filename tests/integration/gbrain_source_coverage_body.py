#!/usr/bin/env python3
"""Explicit in-container gbrain whole-source accounting property."""
from __future__ import annotations
import argparse
import json
import sys
from gbrain_property_support import PropertyError, run_source_property


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--attestation", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--property-id", required=True)
    args = parser.parse_args(argv)
    receipt = run_source_property(args.attestation, args.run_id, args.property_id)
    print(json.dumps({"status": "passed", "property_run_id": receipt["property_run_id"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, PropertyError) as exc:
        print(f"gbrain source coverage property FAILED: {exc}; run only through scripts/test-integration.sh", file=sys.stderr)
        raise SystemExit(1)
