/**
 * moveTowards —— 在约束条件下将当前状态向目标状态逼近。
 *
 * 支持两种状态类型：
 *  - 标量数值：按 maxStep / tolerance 限制步长
 *  - 对象状态：对其数值字段逐键（含嵌套对象递归）应用同样的逼近规则，
 *    非数值字段直接取目标值
 *
 * 输入：
 *  - current   当前状态（number | 对象）
 *  - target    目标状态（number | 对象）
 *  - options.maxStep    单次最大移动步长（绝对值），默认 Infinity
 *  - options.tolerance 容差半径，剩余距离 ≤ tolerance 视为到达，默认 0
 *  - options.keys      仅对象生效，指定参与逼近的键，默认所有共有键
 *
 * 输出：
 *  - state     调整后的新状态
 *  - distance  与目标之间的剩余距离（标量或各维度距离之和）
 *  - reached   是否在容差内到达目标
 *  - ratio     本次已走了目标总距离的多少比例（0~1）
 */

export interface ApproachResult<S> {
  state: S;
  distance: number;
  reached: boolean;
  ratio: number;
}

export interface ApproachOptions {
  maxStep?: number;
  tolerance?: number;
  keys?: string[];
}

export function moveTowards(
  current: number,
  target: number,
  options?: ApproachOptions
): ApproachResult<number>;
export function moveTowards<T extends Record<string, unknown>>(
  current: T,
  target: T,
  options?: ApproachOptions
): ApproachResult<T>;
export function moveTowards(
  current: number | Record<string, unknown>,
  target: number | Record<string, unknown>,
  options: ApproachOptions = {}
): ApproachResult<number | Record<string, unknown>> {
  const { maxStep = Infinity, tolerance = 0, keys = null } = options;

  // 标量数值
  if (typeof current === "number" && typeof target === "number") {
    const diff = target - current;
    const absDiff = Math.abs(diff);

    if (absDiff <= tolerance) {
      return { state: target, distance: 0, reached: true, ratio: 1 };
    }

    const step = Math.sign(diff) * Math.min(absDiff, maxStep);
    const next = current + step;
    const remaining = Math.abs(target - next);

    return {
      state: next,
      distance: remaining,
      reached: remaining <= tolerance,
      ratio: absDiff === 0 ? 1 : step / diff,
    };
  }

  // 对象 / 字典状态
  if (
    current !== null &&
    target !== null &&
    typeof current === "object" &&
    typeof target === "object" &&
    !Array.isArray(current) &&
    !Array.isArray(target)
  ) {
    const cur = current as Record<string, unknown>;
    const tgt = target as Record<string, unknown>;
    const next: Record<string, unknown> = { ...cur };
    let totalDistance = 0;
    let totalTargetDistance = 0;
    let reachedCount = 0;
    let keyCount = 0;

    const keysToUse = keys || Object.keys({ ...cur, ...tgt });

    for (const key of keysToUse) {
      if (!(key in tgt)) continue;

      const curVal = cur[key];
      const tgtVal = tgt[key];

      // 同为数值：受 maxStep / tolerance 约束
      if (typeof curVal === "number" && typeof tgtVal === "number") {
        const diff = tgtVal - curVal;
        const absDiff = Math.abs(diff);
        totalTargetDistance += absDiff;

        if (absDiff <= tolerance) {
          next[key] = tgtVal;
          reachedCount++;
        } else {
          const step = Math.sign(diff) * Math.min(absDiff, maxStep);
          next[key] = curVal + step;
          totalDistance += Math.abs(tgtVal - (next[key] as number));
        }
        keyCount++;

      // 同为普通对象：递归处理
      } else if (
        typeof curVal === "object" &&
        typeof tgtVal === "object" &&
        !Array.isArray(curVal) &&
        !Array.isArray(tgtVal)
      ) {
        const res = moveTowards(
          curVal as Record<string, unknown>,
          tgtVal as Record<string, unknown>,
          options
        );
        next[key] = res.state;
        totalDistance += typeof res.distance === "number" ? res.distance : 0;
        if (res.reached) reachedCount++;
        keyCount++;

      // 非数值叶子节点：直接取目标值
      } else {
        next[key] = tgtVal;
        reachedCount++;
        keyCount++;
      }
    }

    return {
      state: next,
      distance: totalDistance,
      reached: keyCount > 0 && reachedCount === keyCount,
      ratio:
        totalTargetDistance === 0
          ? 1
          : (totalTargetDistance - totalDistance) / totalTargetDistance,
    };
  }

  // 无法处理的其他类型：保持当前状态
  return {
    state: current,
    distance: NaN,
    reached: current === target,
    ratio: 0,
  };
}

export default moveTowards;
