"""精确扫描 v3：
- JSX 标签栈，排除 TS 泛型（如 useState<PatientRecord | null>）造成的栈污染
- 点击代理父级白名单加入 Popover / Tooltip / Dropdown / Popconfirm / Upload 等
- 同时扫描原生 <button>、<a className="row-link"> 等可点元素
"""
import re, os

ROOT = r"C:/Users/zhang/Desktop/MediCode/frontend/src"
# 这些父组件会把点击行为代理给子元素，子元素自身无需 onClick
PROXY_PARENTS = {"Popconfirm", "Upload", "Dropdown", "Form", "Modal", "Drawer",
                 "Popover", "Tooltip", "Tour", "Dropdown.Button"}
EFFECTIVE = ["onClick", "htmlType", "href=", "onMouseEnter", "to=", "onSubmit",
             "onChange", "onConfirm", "onDrop", "trigger"]

HTML_TAGS = {"div", "span", "section", "aside", "table", "thead", "tbody", "tr", "td", "th",
             "form", "label", "b", "i", "p", "small", "strong", "time", "dl", "dt", "dd",
             "h1", "h2", "h3", "h4", "h5", "h6", "ul", "li", "a", "button", "input",
             "textarea", "select", "option", "header", "footer", "main", "nav", "figure",
             "table", "tfoot", "colgroup", "col", "em", "u", "s", "code", "pre", "blockquote"}

dead = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    if "node_modules" in dirpath:
        continue
    for fn in filenames:
        if not fn.endswith(".tsx"):
            continue
        path = os.path.join(dirpath, fn)
        text = open(path, encoding="utf-8").read()
        stack = []
        i = 0
        while i < len(text):
            if text[i] != "<":
                i += 1
                continue
            # 关闭标签
            if text.startswith("</", i):
                m = re.match(r"</\s*([\w.:]+)", text[i:])
                if not m:
                    i += 1
                    continue
                name = m.group(1)
                for k in range(len(stack) - 1, -1, -1):
                    if stack[k] == name:
                        del stack[k:]
                        break
                i += len(m.group(0))
                continue
            m = re.match(r"<\s*([A-Za-z][\w.:]*)", text[i:])
            if not m:
                i += 1
                continue
            name = m.group(1)
            j = i
            depth = 0
            while j < len(text):
                ch = text[j]
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                elif ch == ">" and depth == 0:
                    break
                j += 1
            content = text[i:j + 1]
            # 排除 TS 泛型/比较表达式：属性部分出现顶层 "|" 或首字符为 "|" 的都不是 JSX 标签
            attr_part = content[len(m.group(0)):].strip()
            looks_generic = attr_part.startswith("|") or re.match(r"^[A-Za-z_$][\w$]*\s*\|", attr_part) is not None
            if looks_generic and name not in HTML_TAGS:
                i = j + 1
                continue
            selfclose = content.rstrip().endswith("/>")
            if name in ("Button",) or (name == "button"):
                line = text[:i].count("\n") + 1
                if not any(k in content for k in EFFECTIVE):
                    proxied = [a for a in stack if a in PROXY_PARENTS]
                    if not proxied:
                        decl = re.sub(r"\s+", " ", content)
                        dead.append((os.path.relpath(path, ROOT).replace("\\", "/"), line,
                                     "/".join(stack[-3:]) or "(root)", decl[:150]))
            if not selfclose and name not in ("input", "img", "br", "hr", "col", "area", "source"):
                stack.append(name)
            i = j + 1

        # 可点击的行内链接 <a className="row-link"> 是否绑定 onClick
        for m in re.finditer(r'<a\s+className="row-link"[^>]*>', text):
            tag = m.group(0)
            if "onClick" not in tag:
                line = text[:m.start()].count("\n") + 1
                dead.append((os.path.relpath(path, ROOT).replace("\\", "/"), line, "<a.row-link>", tag[:150]))

dead.sort()
print(f"确认无效交互元素 {len(dead)} 处\n")
for d in dead:
    print(f"{d[0]}:{d[1]}   [父级 {d[2]}]\n    {d[3]}\n")
