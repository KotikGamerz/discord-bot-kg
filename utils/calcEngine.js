const { create, all } = require("mathjs");

const math = create(all);

// корень 

function preprocess(expr) {
  let s = expr;

  // запятая → точка (для mathjs)
  s = s.replace(/(\d),(\d)/g, "$1.$2");

  // √16 → root(16)
  s = s.replace(/√\s*(\d+(\.\d+)?)/g, "root($1)");

  // корень(16) → root(16)
  s = s.replace(/корень\s*\(/gi, "root(");

  return s;
}

function formatNumber(n) {
  const rounded = Math.round(n * 10000) / 10000;

  const parts = String(rounded).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return parts.join(".");
}

function calculate(exprRaw) {
  try {
    if (exprRaw.length > 250) {
      return { ok: false, error: "Ошибка вычисления:\nСлишком длинное выражение." };
    }

    let expr = preprocess(exprRaw);

    const scope = {
      root: x => {
        if (x < 0) throw new Error("Корень из отрицательного числа.");
        return Math.sqrt(x);
      }
    };

    const result = math.evaluate(expr, scope);

    if (!Number.isFinite(result)) {
      return { ok: false, error: "Ошибка вычисления:\nНекорректный результат." };
    }

    return { ok: true, value: formatNumber(result) };

  } catch (err) {
    return {
      ok: false,
      error: "Ошибка вычисления:\n" + (err.message || "Некорректное выражение.")
    };
  }
}

module.exports = { calculate };
