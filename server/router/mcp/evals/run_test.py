import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import run


class EvaluationRunnerTest(unittest.TestCase):
    def test_client_namespaces_are_normalized_in_order(self):
        self.assertEqual(
            run.normalize_answer(" mcp__memos__memo_list_memos,mcp__memos__memo_get_memo\n", "selection"),
            "memo_list_memos, memo_get_memo",
        )

    def test_saved_answers_have_a_nonzero_exit_on_failure(self):
        suite = Path(__file__).with_name("tool_selection_eval.xml")
        _, pairs = run.load_suite(suite)
        with tempfile.TemporaryDirectory() as directory:
            answers = Path(directory) / "answers.json"
            report = Path(directory) / "report.json"
            values = [pair["expected"] for pair in pairs]
            answers.write_text(json.dumps(values))
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(run.main(["--answers", str(answers), "--report", str(report)]), 0)
            self.assertEqual(json.loads(report.read_text())["passed"], len(pairs))
            values[0] = "wrong_tool"
            answers.write_text(json.dumps(values))
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(run.main(["--answers", str(answers)]), 1)

    def test_incomplete_answers_are_rejected(self):
        with self.assertRaises(ValueError):
            run.score_answers([{"question": "q", "expected": "a"}], [], "tasks")

    def test_runner_receives_no_expected_answers_and_errors_hide_credentials(self):
        output = io.StringIO()
        with patch.object(run, "fetch_tools", return_value=[]), patch.object(run.subprocess, "run") as execute:
            execute.return_value.returncode = 1
            execute.return_value.stderr = "Bearer sensitive-test-token"
            with contextlib.redirect_stderr(output):
                self.assertEqual(run.main(["--runner", "example-runner"]), 2)
            prompt = json.loads(execute.call_args.kwargs["input"])
            self.assertNotIn("expected", prompt)
            self.assertEqual(prompt["mode"], "selection")
            self.assertNotIn("sensitive-test-token", output.getvalue())


if __name__ == "__main__":
    unittest.main()
