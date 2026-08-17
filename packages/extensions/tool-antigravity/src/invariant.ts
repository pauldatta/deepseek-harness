/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-tool-antigravity`.
 * @module @deepseek-ai/dsh-tool-antigravity/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-tool-antigravity'

export const name = 'tool-antigravity-invariant'
export const inject = ['invariants']

const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
