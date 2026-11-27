import base64
import io
import json
import os
import unittest
from contextlib import redirect_stdout, redirect_stderr
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch
from urllib.error import HTTPError

from scripts.supabase_keepalive import ANCHOR, main, make_request, should_query


class KeepaliveTest(unittest.TestCase):
    def test_three_day_interval_across_months_and_years(self):
        days = [ANCHOR + timedelta(days=i) for i in range(400)]
        selected = [day for day in days if should_query("schedule", day)]
        self.assertTrue(all((right - left).days == 3 for left, right in zip(selected, selected[1:])))
        self.assertEqual(selected[:3], [date(2026, 11, 27), date(2026, 11, 30), date(2026, 12, 3)])
        self.assertTrue(should_query("workflow_dispatch", ANCHOR + timedelta(days=1)))

    def test_read_only_request_and_public_keys(self):
        request = make_request("https://example.supabase.co/", "sb_publishable_example")
        self.assertEqual(request.get_method(), "GET")
        self.assertTrue(request.full_url.endswith("/rest/v1/wheels?select=id&limit=1"))
        self.assertIsNone(request.data)
        for role in ("anon", "service_role"):
            encoded = base64.urlsafe_b64encode(json.dumps({"role": role}).encode()).decode().rstrip("=")
            key = "header." + encoded + ".signature"
            if role == "anon":
                self.assertEqual(make_request("https://example.supabase.co", key).get_header("Authorization"), "Bearer " + key)
            else:
                with self.assertRaises(ValueError):
                    make_request("https://example.supabase.co", key)

    def test_query_success_failure_and_no_key_in_logs(self):
        key = "sb_publishable_example"
        with patch.dict(os.environ, {"EVENT_NAME": "push", "SUPABASE_URL": "https://example.supabase.co", "SUPABASE_PUBLIC_KEY": key}):
            output = io.StringIO()
            with patch("scripts.supabase_keepalive.urlopen", return_value=io.BytesIO(b'[{"id":"not-logged"}]')) as network, redirect_stdout(output):
                self.assertEqual(main(), 0)
                self.assertEqual(network.call_count, 1)
            with patch("scripts.supabase_keepalive.urlopen", side_effect=HTTPError("https://example.supabase.co", 503, "Unavailable", {}, None)), redirect_stderr(output):
                self.assertEqual(main(), 1)
            self.assertNotIn(key, output.getvalue())
            self.assertNotIn("not-logged", output.getvalue())

    def test_no_request_on_intermediate_days_even_without_credentials(self):
        with patch.dict(os.environ, {"EVENT_NAME": "schedule"}, clear=True), patch("scripts.supabase_keepalive.datetime") as clock, patch("scripts.supabase_keepalive.urlopen") as network, redirect_stdout(io.StringIO()):
            clock.now.return_value = datetime(2026, 11, 28, tzinfo=timezone.utc)
            self.assertEqual(main(), 0)
            network.assert_not_called()


if __name__ == "__main__":
    unittest.main()
