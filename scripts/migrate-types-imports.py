#!/usr/bin/env python3
"""Migra imports de '@azy-board/types' para os packages por domínio."""
import re, sys, os
from pathlib import Path

# Map: symbol -> package
DOMAIN = '@azy-board/domain'
API = '@azy-board/api-contracts'
REALTIME = '@azy-board/realtime-contracts'
ASSISTANT = '@azy-board/assistant-contracts'
UI = '@azy-board/ui-contracts'

SYMBOL_MAP = {
    # domain
    'TaskStatus': DOMAIN, 'ColumnBaseStatus': DOMAIN, 'Priority': DOMAIN,
    'TaskType': DOMAIN, 'ItemType': DOMAIN, 'MemberRole': DOMAIN,
    'GlobalGroup': DOMAIN, 'BoardMode': DOMAIN, 'SprintStatus': DOMAIN,
    'Sprint': DOMAIN, 'NodeType': DOMAIN, 'ProjectVisibility': DOMAIN,
    'ActivityActorType': DOMAIN, 'ActivitySource': DOMAIN,
    # api-contracts
    'ErrorDetails': API, 'ApiErrorPayload': API, 'JwtPayload': API, 'RequestContext': API,
    # realtime-contracts
    'WsEventType': REALTIME, 'WsEvent': REALTIME,
    # assistant-contracts
    'AssistantProvider': ASSISTANT, 'AssistantCredentialMode': ASSISTANT,
    'AssistantValidationStatus': ASSISTANT, 'AssistantAvailabilityStatus': ASSISTANT,
    'AssistantConversationRole': ASSISTANT, 'AssistantRunStatus': ASSISTANT,
    'AssistantEventType': ASSISTANT, 'AssistantToolCallStatus': ASSISTANT,
    'AssistantRiskLevel': ASSISTANT, 'AssistantApprovalStatus': ASSISTANT,
    'AssistantScreen': ASSISTANT, 'AssistantAvailability': ASSISTANT,
    'AssistantProviderConfiguration': ASSISTANT, 'AssistantCredentialMetadata': ASSISTANT,
    'AssistantConversation': ASSISTANT, 'AssistantMessage': ASSISTANT,
    'AssistantRun': ASSISTANT, 'AssistantEvent': ASSISTANT,
    'AssistantToolCall': ASSISTANT, 'AssistantPreview': ASSISTANT,
    'AssistantApproval': ASSISTANT,
    'Governance': ASSISTANT, 'GOVERNANCE_KEYS': ASSISTANT,
    'DEFAULT_GOVERNANCE': ASSISTANT, 'GOVERNANCE_BOUNDS': ASSISTANT,
    'HARNESS_LIMITS': ASSISTANT, 'MAX_MESSAGE_BYTES': ASSISTANT,
    'MAX_ASSISTANT_ACTIONS': ASSISTANT,
    # ui-contracts
    'Theme': UI, 'Language': UI, 'LightShellTheme': UI, 'UserPreferences': UI,
    'AncestorNode': UI, 'AncestorRef': UI, 'Tag': UI, 'Card': UI, 'toCard': UI,
    'ChecklistItem': UI, 'Checklist': UI, 'ChecklistProgress': UI,
    'WorkLog': UI, 'parseWorkDuration': UI, 'formatWorkDuration': UI,
    'DashboardFilterKey': UI, 'DashboardBoxKey': UI, 'DashboardState': UI,
    'DashboardFilters': UI, 'DashboardFilterInfo': UI, 'DashboardCoverage': UI,
    'DashboardItemDetail': UI, 'DashboardSnapshot': UI,
    'DashboardBurnupPoint': UI, 'DashboardBurnup': UI,
    'DashboardAging': UI, 'DashboardHours': UI,
}

IMPORT_RE = re.compile(
    r"import\s+(type\s+)?\{([^}]+)\}\s+from\s+['\"]@azy-board/types['\"]",
    re.MULTILINE
)

def parse_imports(match_str: str) -> list[str]:
    """Parse imported symbols from the braces content."""
    symbols = []
    for part in match_str.split(','):
        part = part.strip()
        if not part:
            continue
        # Handle "type X" prefix
        part = re.sub(r'^type\s+', '', part)
        # Handle "X as Y" aliases
        symbols.append(part)
    return symbols

def migrate_file(path: Path) -> bool:
    content = path.read_text()
    if "@azy-board/types" not in content:
        return False

    def replace_import(match):
        is_type_import = bool(match.group(1))
        symbols_str = match.group(2)
        symbols = parse_imports(symbols_str)

        # Group symbols by target package
        by_pkg = {}
        for sym in symbols:
            pkg = SYMBOL_MAP.get(sym)
            if pkg is None:
                # Unknown symbol — keep in @azy-board/types (barrel)
                pkg = '@azy-board/types'
            by_pkg.setdefault(pkg, []).append(sym)

        # Generate new import statements
        imports = []
        for pkg in sorted(by_pkg.keys()):
            syms = sorted(by_pkg[pkg])
            prefix = 'type ' if is_type_import else ''
            imports.append(f"import {prefix}{{ {', '.join(syms)} }} from '{pkg}'")
        return '\n'.join(imports)

    new_content = IMPORT_RE.sub(replace_import, content)
    if new_content != content:
        path.write_text(new_content)
        return True
    return False

def main():
    root = Path(__file__).parent.parent
    changed = 0
    for pattern in ['apps/**/*.ts', 'apps/**/*.tsx', 'packages/**/*.ts', 'scripts/**/*.ts']:
        for path in root.glob(pattern):
            if 'node_modules' in str(path) or 'dist' in str(path):
                continue
            if migrate_file(path):
                print(f'  migrated: {path.relative_to(root)}')
                changed += 1
    print(f'\n{changed} files migrated')

if __name__ == '__main__':
    main()
