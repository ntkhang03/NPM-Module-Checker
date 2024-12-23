module.exports = function (dependencies) {
  const regex = new RegExp(
    `(?:require\\s*\\(\\s*["'\`](?:${dependencies.join("|")})["'\`]\\s*\\)|import(?:\\s+[\\w*{},\\s"'\`]*from)?\\s*["'\`](?:${dependencies.join("|")})["'\`]\\s*|import\\s*\\(\\s*["'\`](?:${dependencies.join("|")})["'\`]\\s*\\))`,
    "g"
  );

  return regex;
};
