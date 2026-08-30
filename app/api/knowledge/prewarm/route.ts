import { NextResponse } from "next/server";
import { pool } from "@/lib/db/client";
import { generateAllContent } from "@/lib/llm/content-generator";

export const dynamic = "force-dynamic";

/**
 * 预热接口：查找下一个未生成 all_content 缓存的知识点，并触发生成。
 * 前端在空闲时轮询此接口，每次预热一个知识点。
 *
 * GET /api/knowledge/prewarm
 *   - 返回 { prewarmed: true, kpId, title } 成功生成
 *   - 返回 { prewarmed: false, reason: "all_done" } 全部已缓存
 *   - 返回 { prewarmed: false, reason: "busy" } 正在生成中（防并发）
 */

// 简单的内存锁，防止并发预热
let prewarming = false;

export async function GET() {
  // 防并发：如果正在生成，直接返回 busy
  if (prewarming) {
    return NextResponse.json({ prewarmed: false, reason: "busy" });
  }

  try {
    // 查找下一个未缓存 all_content 的知识点（有 grade_level 的叶子节点）
    const result = await pool.query(
      `SELECT kp.id, kp.title, kp.grade_level
       FROM knowledge_points kp
       WHERE kp.subject = 'math'
         AND kp.grade_level IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM content_cache cc
           WHERE cc.kp_id = kp.id
             AND cc.content_type = 'all_content'
             AND cc.expires_at > NOW()
         )
       ORDER BY kp.grade_level, kp.id
       LIMIT 1`
    );

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ prewarmed: false, reason: "all_done" });
    }

    const kp = result.rows[0] as { id: number; title: string; grade_level: number };

    // 加锁并生成
    prewarming = true;
    try {
      await generateAllContent(kp.id);
      return NextResponse.json({
        prewarmed: true,
        kpId: kp.id,
        title: kp.title,
      });
    } finally {
      prewarming = false;
    }
  } catch (error) {
    prewarming = false;
    const msg = error instanceof Error ? error.message : "预热失败";
    return NextResponse.json(
      { prewarmed: false, reason: "error", error: msg },
      { status: 500 }
    );
  }
}
