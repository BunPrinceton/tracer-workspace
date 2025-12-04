#!/usr/bin/env python3
"""
Monitor the validation progress of a running batch ID validation.

Usage:
    python monitor_validation.py --progress-log validation_progress.json
"""

import argparse
import json
import time
import sys
from pathlib import Path


def read_progress_log(filepath):
    """Read and parse the progress log JSON file."""
    try:
        with open(filepath, 'r') as f:
            progress = json.load(f)
        return progress
    except FileNotFoundError:
        return None
    except json.JSONDecodeError:
        print(f"Error: Could not parse JSON file: {filepath}", file=sys.stderr)
        return None


def format_progress(progress):
    """Format progress data for display."""
    if not progress:
        return "No progress logged yet..."

    total_processed = sum(p['count'] for p in progress)
    total_changed = sum(p['changed'] for p in progress)
    completed_batches = len(progress)

    output = f"""
Validation Progress
===================
Batches completed: {completed_batches}
Total IDs processed: {total_processed}
Total changed: {total_changed}
Percentage changed: {(total_changed/total_processed*100 if total_processed > 0 else 0):.2f}%

Batch Details:
"""
    for p in progress:
        batch_num = p['batch']
        count = p['count']
        changed = p['changed']
        unchanged = count - changed
        pct = (changed/count*100 if count > 0 else 0)

        output += f"  Batch {batch_num:2d}: {count:4d} IDs ({changed:4d} changed, {unchanged:4d} current) - {pct:.1f}%\n"

    return output


def watch_progress(filepath, interval=10):
    """Continuously watch and display progress updates."""
    print(f"Monitoring progress log: {filepath}")
    print(f"(Updates every {interval} seconds, Ctrl+C to stop)")
    print("=" * 60)

    last_batch_count = 0

    try:
        while True:
            progress = read_progress_log(filepath)

            if progress:
                current_batch_count = len(progress)

                # Only print if there's new data
                if current_batch_count > last_batch_count:
                    print(f"\n[Update at {time.strftime('%Y-%m-%d %H:%M:%S')}]")
                    print(format_progress(progress))
                    last_batch_count = current_batch_count
                else:
                    # Still processing current batch
                    batches_done = len(progress)
                    print(f"\r[Waiting...] {batches_done} batches completed, processing batch {batches_done + 1}...", end='', flush=True)
            else:
                print(f"\r[Waiting for results...] ({time.strftime('%H:%M:%S')})", end='', flush=True)

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\n\nMonitoring stopped.")
        if progress:
            print("\nFinal Progress:")
            print(format_progress(progress))


def main():
    parser = argparse.ArgumentParser(
        description="Monitor batch validation progress",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--progress-log", "-p", required=True,
                        help="Path to progress JSON log file")
    parser.add_argument("--interval", "-i", type=int, default=10,
                        help="Update interval in seconds (default: 10)")
    parser.add_argument("--once", action="store_true",
                        help="Show progress once and exit (don't monitor)")

    args = parser.parse_args()

    if args.once:
        progress = read_progress_log(args.progress_log)
        print(format_progress(progress))
    else:
        watch_progress(args.progress_log, args.interval)


if __name__ == "__main__":
    main()
