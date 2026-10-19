#!/usr/bin/env python3
"""Run MCP XML evaluations with a local model runner, or score saved answers.

The runner reads one JSON object on stdin and writes only its final answer on
stdout. It owns the model integration and, in task mode, MCP tool execution.
No model provider, credentials, or third-party Python packages are required.
"""

import argparse
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import urllib.request
import xml.etree.ElementTree as ET


def load_suite(path):
    root = ET.parse(path).getroot()
    pairs = []
    for pair in root.findall("qa_pair"):
        question = (pair.findtext("question") or "").strip()
        answer = (pair.findtext("answer") or "").strip()
        if not question or not answer:
            raise ValueError("Every evaluation needs a non-empty question and answer")
        pairs.append({"question": question, "expected": answer})
    if not pairs:
        raise ValueError("Evaluation suite is empty")
    mode = root.get("mode", "tasks")
    if mode not in ("tasks", "selection"):
        raise ValueError("Evaluation mode must be tasks or selection")
    return mode, pairs


def normalize_answer(answer, mode):
    answer = answer.strip()
    if mode == "selection":
        # Remove client namespaces only, preserving tool order and exact names.
        answer = re.sub(r"\bmcp__[^\s,]+?__", "", answer)
        return ", ".join(part.strip() for part in answer.split(","))
    return answer


def score_answers(pairs, answers, mode):
    if len(answers) != len(pairs) or any(not isinstance(answer, str) for answer in answers):
        raise ValueError("Answers must contain exactly one string per evaluation question")
    results = []
    for index, (pair, answer) in enumerate(zip(pairs, answers), 1):
        actual = normalize_answer(answer, mode)
        results.append({"id": index, **pair, "actual": actual, "passed": actual == pair["expected"]})
    return {"passed": sum(result["passed"] for result in results), "total": len(results), "results": results}


def fetch_tools(url, headers, timeout):
    request = urllib.request.Request(
        url,
        data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream", **headers},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.load(response)
    if "error" in payload:
        raise ValueError("MCP tools/list failed")
    return payload["result"]["tools"]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--suite", type=Path, default=Path(__file__).with_name("tool_selection_eval.xml"))
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--runner", help="Executable and arguments; invoked directly, without a shell")
    source.add_argument("--answers", type=Path, help="JSON array of final answers, in XML question order")
    parser.add_argument("--mcp-url", default="http://localhost:8099/mcp")
    parser.add_argument("--timeout", type=int, default=60, help="Per-question and HTTP timeout in seconds")
    parser.add_argument("--report", type=Path, help="Optional JSON report file")
    args = parser.parse_args(argv)
    if args.timeout <= 0:
        parser.error("--timeout must be positive")
    try:
        mode, pairs = load_suite(args.suite)
        if args.answers:
            answers = json.loads(args.answers.read_text())
            if not isinstance(answers, list):
                raise ValueError("Answers file must be a JSON array")
        else:
            command = shlex.split(args.runner)
            if not command:
                raise ValueError("Runner command is empty")
            token = os.environ.get("MEMOS_MCP_TOKEN", "")
            headers = {"Authorization": "Bearer " + token} if token else {}
            tools = fetch_tools(args.mcp_url, headers, args.timeout)
            answers = []
            for index, pair in enumerate(pairs, 1):
                prompt = {
                    "question": pair["question"], "mode": mode, "tools": tools,
                    "instructions": "Return only the final answer. Do not execute tools in selection mode. Task evaluations are read-only.",
                    "mcp": {"url": args.mcp_url, "headers": headers},
                }
                result = subprocess.run(
                    command, input=json.dumps(prompt), text=True, capture_output=True, timeout=args.timeout, check=False,
                )
                if result.returncode != 0:
                    # Runner stderr may contain request headers. Never echo it.
                    raise ValueError(f"Runner failed on question {index} (exit {result.returncode})")
                answers.append(result.stdout)
        report = score_answers(pairs, answers, mode)
        if args.report:
            args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if report["passed"] == report["total"] else 1
    except (OSError, ValueError, KeyError, ET.ParseError, subprocess.TimeoutExpired):
        # Keep credentials and runner input out of terminal errors as well.
        print("Evaluation could not complete; check the suite, answers, endpoint and runner configuration.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
