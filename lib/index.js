var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply,
  filter: () => filter,
  inject: () => inject,
  name: () => name,
  reusable: () => reusable,
  usage: () => usage
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var reusable = false;
var filter = false;
var name = "nyan-fork";
var inject = {
  required: ["database"]
  // optional: ['']
};
var logger = new import_koishi.Logger("nyan-fork");
var usage = `
---
`;
var Config = import_koishi.Schema.intersect([
  import_koishi.Schema.object({
    transformLastLineOnly: import_koishi.Schema.boolean().default(true).description("只在发送文本的最后一行进行卖萌，否则每行都进行语气词替换"),
    noises: import_koishi.Schema.array(import_koishi.Schema.object({
      enabled: import_koishi.Schema.boolean().default(true).description("是否启用此语气词"),
      word: import_koishi.Schema.string().required().description("语气词内容")
    })).role("table").default([
      { enabled: true, word: "喵" },
      { enabled: false, word: "nya" },
      { enabled: false, word: "汪" }
    ]).description("随机取勾选的语气词中的一个作为语句结尾")
  }).description("基础配置"),
  import_koishi.Schema.object({
    appendIfNoTrailing: import_koishi.Schema.string().default("~").description("没有标点的句末后面会被加上这个"),
    trailing: import_koishi.Schema.array(import_koishi.Schema.object({
      target: import_koishi.Schema.string().required().description("要被替换的标点符号"),
      replacement: import_koishi.Schema.string().required().description("替换后的标点符号")
    })).role("table").default([
      { target: "，", replacement: "~" },
      { target: "。", replacement: "~" },
      { target: ",", replacement: "~" },
      { target: ".", replacement: "~" }
    ]).description("替换发送消息中的标点符号，两个以上连在一起的标点不会被替换")
  }).description("标点控制"),
  import_koishi.Schema.object({
    filterMode: import_koishi.Schema.union(["blacklist", "whitelist"]).description("消息过滤模式").default("blacklist"),
    logBlocked: import_koishi.Schema.boolean().description("是否记录被屏蔽消息的日志").default(false)
  }).description("消息级过滤"),
  import_koishi.Schema.union([
    import_koishi.Schema.object({
      filterMode: import_koishi.Schema.const("blacklist"),
      blacklist: import_koishi.Schema.array(import_koishi.Schema.object({
        type: import_koishi.Schema.union([
          import_koishi.Schema.const("userId").description("用户 ID"),
          import_koishi.Schema.const("channelId").description("频道 ID"),
          import_koishi.Schema.const("guildId").description("群组 ID"),
          import_koishi.Schema.const("platform").description("平台名称")
        ]).description("过滤类型").role("radio").default("userId"),
        value: import_koishi.Schema.string().description("过滤值").required(),
        reason: import_koishi.Schema.string().description("过滤原因（备注）")
      })).role("table").description("消息黑名单规则").default([])
    }),
    import_koishi.Schema.object({
      filterMode: import_koishi.Schema.const("whitelist").required(),
      whitelist: import_koishi.Schema.array(import_koishi.Schema.object({
        type: import_koishi.Schema.union([
          import_koishi.Schema.const("userId").description("用户 ID"),
          import_koishi.Schema.const("channelId").description("频道 ID"),
          import_koishi.Schema.const("guildId").description("群组 ID"),
          import_koishi.Schema.const("platform").description("平台名称")
        ]).description("过滤类型").role("radio").default("userId"),
        value: import_koishi.Schema.string().description("过滤值").required(),
        reason: import_koishi.Schema.string().description("过滤原因（备注）")
      })).role("table").description("消息白名单规则").default([])
    })
  ])
]);
var madeNoise = /喵([^\p{L}\d\s@#]+)?( +)?$/u;
var trailingURL = /[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}\b([-a-zA-Z0-9()@:%_+.~#?&//<>{}]*)?$/u;
var trailingChars = /(?<content>.*?)(?<trailing>[^\p{L}\d\s@#]+)?(?<trailingSpace> +)?$/u;
var withDefault = /* @__PURE__ */ __name((_default) => (template, ...args) => {
  let returnValue = "";
  template.forEach((val, index) => {
    returnValue += val;
    const arg = args[index];
    if (arg !== void 0) {
      returnValue += arg;
    } else {
      returnValue += _default;
    }
  });
  return returnValue;
}, "withDefault");
var _transform = /* @__PURE__ */ __name((trailingChars2, transforms) => {
  const last = trailingChars2.slice(-1);
  if (trailingChars2.length > 1) {
    const secondLast = trailingChars2.slice(-2, -1);
    if (last === secondLast) return trailingChars2;
  }
  for (const item of transforms) {
    if (last !== item.target) continue;
    return trailingChars2.slice(0, -1) + item.replacement;
  }
  return trailingChars2;
}, "_transform");
var processSingleLine = /* @__PURE__ */ __name((noiseMaker, config) => (line, index, lines) => {
  const { trailing, appendIfNoTrailing, transformLastLineOnly } = config;
  if (transformLastLineOnly && index < lines.length - 1) {
    return line;
  }
  if (line.trim() === "") {
    return line;
  }
  if (madeNoise.test(line)) {
    return line;
  }
  if (trailingURL.test(line)) {
    return line;
  }
  const noise = noiseMaker();
  const match = line.match(trailingChars);
  if (!match || !match.groups) return line;
  let { content, trailing: trailingPunct, trailingSpace } = match.groups;
  if (!trailingPunct) {
    trailingPunct = appendIfNoTrailing;
  } else if (trailing.length) {
    trailingPunct = _transform(trailingPunct, trailing);
  }
  return withDefault("")`${content}${noise}${trailingPunct}${trailingSpace}`;
}, "processSingleLine");
var processElements = /* @__PURE__ */ __name((elements, noiseMaker, config) => {
  const { transformLastLineOnly } = config;
  if (!elements?.length) return elements;
  const result = [];
  const end = [];
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];
    if (element.type === "text" && element.attrs.content && element.attrs.content.trim() !== "") {
      break;
    }
    end.unshift(elements[i]);
  }
  const mainElements = elements.slice(0, elements.length - end.length);
  for (let i = 0; i < mainElements.length; i++) {
    const element = mainElements[i];
    if (element.type !== "text") {
      result.push(element);
      continue;
    }
    if (transformLastLineOnly && i < mainElements.length - 1) {
      result.push(element);
      continue;
    }
    const content = element.attrs.content || "";
    const lines = content.split("\n");
    const processedLines = lines.map(processSingleLine(noiseMaker, config));
    result.push(import_koishi.h.text(processedLines.join("\n")));
  }
  return result.concat(end);
}, "processElements");
var shuffle = /* @__PURE__ */ __name((arr) => arr.map((value) => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value), "shuffle");
var makeNoise = /* @__PURE__ */ __name((noises) => {
  const enabledNoises = noises.filter((item) => item.enabled).map((item) => item.word);
  if (enabledNoises.length === 0) {
    return () => "";
  }
  let randomNoise = shuffle([...enabledNoises]);
  return function() {
    if (randomNoise.length === 0) {
      randomNoise = shuffle([...enabledNoises]);
    }
    return randomNoise.pop();
  };
}, "makeNoise");
var checkFilter = /* @__PURE__ */ __name(async (session, config, ctx) => {
  const platform = session.platform;
  const channelId = session.channelId;
  const guildId = session.guildId;
  let platformUserId;
  if (session.user && ctx.database) {
    try {
      const userId = session.user["id"];
      if (userId) {
        const bindings = await ctx.database.get("binding", {
          aid: userId,
          platform
        });
        if (bindings.length > 0) {
          platformUserId = bindings[0].pid;
        }
      }
    } catch (error) {
      logger.error("查询用户绑定信息失败:", error);
    }
  }
  const rules = config.filterMode === "blacklist" ? config.blacklist : config.whitelist;
  if (!rules || rules.length === 0) {
    return config.filterMode === "blacklist";
  }
  const matched = rules.some((rule) => {
    switch (rule.type) {
      case "userId":
        return platformUserId && rule.value === platformUserId;
      case "channelId":
        return channelId && rule.value === channelId;
      case "guildId":
        return guildId && rule.value === guildId;
      case "platform":
        return platform && rule.value === platform;
      default:
        return false;
    }
  });
  const shouldProcess = config.filterMode === "blacklist" ? !matched : matched;
  if (!shouldProcess && config.logBlocked) {
    logger.info("消息被过滤器拦截", {
      mode: config.filterMode,
      userId: platformUserId,
      channelId,
      guildId,
      platform
    });
  }
  return shouldProcess;
}, "checkFilter");
function apply(ctx, config) {
  const dispose = ctx.on("before-send", async (session) => {
    const shouldProcess = await checkFilter(session, config, ctx);
    if (!shouldProcess) {
      return;
    }
    try {
      const noiseMaker = makeNoise(config.noises);
      if (session.elements && Array.isArray(session.elements)) {
        session.elements = processElements(session.elements, noiseMaker, config);
      }
    } catch (error) {
      logger.error("处理消息时出错:", error);
    }
  });
  ctx.on("dispose", () => {
    dispose();
  });
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  filter,
  inject,
  name,
  reusable,
  usage
});
