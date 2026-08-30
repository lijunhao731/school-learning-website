"use client";

import { useEffect, useRef, useState } from "react";
import { SUBJECTS } from "@/lib/subjects";

/**
 * 后台预热组件：用户空闲时自动轮询 /api/knowledge/prewarm，
 * 每次预热一个未缓存的知识点内容。
 *
 * 空闲判定：用户 30 秒内无任何交互（鼠标移动、点击、键盘、滚动）。
 * 非空闲时停止预热。
 *
 * 该组件不渲染任何 UI（返回 null），只做后台工作。
 */
const IDLE_THRESHOLD = 30_000; // 30秒无操作判定为空闲
const PREWARM_INTERVAL = 5_000; // 空闲时每 5 秒预热一个

export function ContentPrewarmer() {
  const [isIdle, setIsIdle] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const prewarmingRef = useRef(false);

  // 用户活动追踪
  useEffect(() => {
    function onActivity() {
      lastActivityRef.current = Date.now();
      if (isIdle) setIsIdle(false);
    }

    const events = ["mousemove", "click", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    // 定期检查空闲状态
    const idleChecker = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_THRESHOLD && !isIdle) {
        setIsIdle(true);
      }
    }, 5_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(idleChecker);
    };
  }, [isIdle]);

  // 空闲时预热
  useEffect(() => {
    if (!isIdle) return;
    if (prewarmingRef.current) return;

    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    async function prewarmOne() {
      if (stopped || prewarmingRef.current) return;
      prewarmingRef.current = true;

      try {
        // 轮询所有学科，每次找一个未缓存的 KP
        for (const subj of SUBJECTS) {
          const res = await fetch(`/api/knowledge/prewarm?subject=${subj.value}`);
          const data = (await res.json()) as {
            prewarmed: boolean;
            reason?: string;
            kpId?: number;
            title?: string;
          };

          if (data.prewarmed) {
            // 成功预热了一个，继续下一个
            break;
          }
          // all_done 或 busy，尝试下一个学科
        }
      } catch {
        // 网络错误，静默忽略
      } finally {
        prewarmingRef.current = false;
      }

      // 继续下一个（如果仍然空闲且未停止）
      if (!stopped) {
        timer = setTimeout(prewarmOne, PREWARM_INTERVAL);
      }
    }

    // 用 requestIdleCallback 延迟启动，确保不阻塞渲染
    if ("requestIdleCallback" in window) {
      const handle = (window as Window).requestIdleCallback(() => {
        prewarmOne();
      });
      return () => {
        stopped = true;
        clearTimeout(timer);
        (window as Window).cancelIdleCallback?.(handle);
      };
    } else {
      timer = setTimeout(prewarmOne, 1000);
      return () => {
        stopped = true;
        clearTimeout(timer);
      };
    }
  }, [isIdle]);

  return null;
}
