export const systemPrompt = `你是一位经验丰富的中小学数学老师。你用清晰、准确的语言讲解知识点，使用适合学生年级的表达方式。语言简洁、准确、符合教学规律。所有内容必须用中文呈现。`;

/** 核心概念：只讲定义和核心思想，不展开例题和练习 */
export function buildIntroPrompt(kpTitle: string, grade: string): string {
  return `知识点：${kpTitle}
年级：${grade}

请用3-5句话介绍这个知识点的核心概念和定义。要求：
- 只讲"是什么"和"为什么"，不要举例题，不要讲练习
- 如果有关键公式或定义，直接给出
- 简明扼要，控制在200字以内
用中文回答。`;
}

/** 详细讲解：深入展开方法、步骤、易错点，不含例题（例题在单独的Tab） */
export function buildDetailPrompt(kpTitle: string, grade: string): string {
  return `知识点：${kpTitle}
年级：${grade}

请深入讲解这个知识点的方法和要点。要求：
1. 计算方法或解题步骤（分步骤说明）
2. 关键技巧和注意事项
3. 常见错误及避免方法
- 不要出例题（例题在单独页面），不要出练习题
- 内容详实，但聚焦方法和思路
用中文回答，数学公式可以用文字描述。`;
}
