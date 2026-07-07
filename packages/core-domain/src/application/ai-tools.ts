/**
 * The AI tool path (ADR 0008 §2): AI "tools" are descriptors over the **existing** use cases. The agent
 * loop executes a proposed tool call through the same command handler — and therefore the same
 * `PolicyPort` check (ADR 0009/0010 §2) — as the UI. There is **no privileged AI path**: an AI-driven
 * action can do no more than the actor it runs on behalf of, which is exactly what the skeleton's
 * authz-parity pass criterion proves (ADR 0022 §9).
 *
 * A future MCP server is just another inbound adapter over this same tool set (ADR 0008 §8).
 */

import type { EntityId, Result } from '@grimora/shared-types';
import { err, ok } from '@grimora/shared-types';
import { type AppError, appError } from '../domain/errors';
import type { Actor, AiProviderPort, PolicyAction } from './ports';
import { type CommandDeps, rollCheck, setAttribute } from './use-cases';

/** A tool descriptor: a name, the use case it maps to (documented via its authz action), and its executor. */
export interface AiTool {
  readonly name: string;
  /** The policy action the mapped use case enforces — same authz as the UI (ADR 0008 §2). */
  readonly action: PolicyAction;
  /** Execute the tool by invoking its use case (which performs the authz + validation). */
  execute(
    deps: CommandDeps,
    actor: Actor,
    args: Readonly<Record<string, unknown>>,
  ): Promise<Result<void, AppError>>;
}

/** Read a required string argument from a tool call. */
function requireString(args: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
}

/** The core-contributed AI tools (plugins would contribute more, namespaced — ADR 0008 §3). */
export function coreAiTools(): readonly AiTool[] {
  return [
    {
      name: 'core.character.rollCheck',
      action: 'character.rollCheck',
      async execute(deps, actor, args) {
        const characterId = requireString(args, 'characterId');
        const checkId = requireString(args, 'checkId');
        if (!characterId || !checkId) {
          return err(appError('ai.invalid_args', 'Validation'));
        }
        return rollCheck(deps, { characterId: characterId as EntityId, checkId, actor });
      },
    },
    {
      name: 'core.character.setAttribute',
      action: 'character.setAttribute',
      async execute(deps, actor, args) {
        const characterId = requireString(args, 'characterId');
        const attributeId = requireString(args, 'attributeId');
        const value = args.value;
        if (!characterId || !attributeId || typeof value !== 'number') {
          return err(appError('ai.invalid_args', 'Validation'));
        }
        return setAttribute(deps, {
          characterId: characterId as EntityId,
          attributeId,
          value,
          actor,
        });
      },
    },
  ];
}

/** The result of an AI turn that executed a tool. */
export interface AiTurnResult {
  readonly tool: string;
}

/**
 * Run one AI turn: ask the provider to propose a tool call for `message`, then execute it through the
 * mapped use case (same authz as the UI). Returns which tool ran, or the use case's error — an
 * unauthorized actor is rejected by the use case's `PolicyPort` check exactly as in the UI path.
 *
 * @param deps   the command ports (incl. `PolicyPort`)
 * @param ai     the AI provider (proposes a tool call)
 * @param actor  the actor the AI acts on behalf of (its permissions bound the AI)
 * @param message  the user's natural-language message
 */
export async function runAiToolTurn(
  deps: CommandDeps,
  ai: AiProviderPort,
  actor: Actor,
  message: string,
): Promise<Result<AiTurnResult, AppError>> {
  const tools = coreAiTools();
  const proposal = await ai.propose(
    message,
    tools.map((t) => t.name),
  );
  if (!proposal) {
    return err(appError('ai.no_tool_proposed', 'Validation'));
  }
  const tool = tools.find((t) => t.name === proposal.tool);
  if (!tool) {
    return err(appError('ai.unknown_tool', 'NotFound'));
  }
  const executed = await tool.execute(deps, actor, proposal.args);
  if (!executed.ok) return executed;
  return ok({ tool: tool.name });
}
