UPDATE assistant_settings
SET max_steps = 32, max_tool_calls = 40, max_payload_bytes = 100000
WHERE max_steps = 4 AND max_tool_calls = 8;
