import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// 支持的登录方式：
// 1. 目前：用户名 + 密码（环境变量配置）
// 2. 后续：换成 Microsoft/Lark/Google SSO，只需在 providers 里加对应 provider

const validUsers = (process.env.AUTH_USERS || "")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean)
  .map((entry) => {
    const [username, password] = entry.split(":");
    return { username, password };
  });

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,  // 信任所有 host（Vercel/本地均适用）
  providers: [
    Credentials({
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string;
        const password = credentials?.password as string;
        if (!username || !password) return null;

        const user = validUsers.find(
          (u) => u.username === username && u.password === password
        );
        if (!user) return null;

        return { id: user.username, name: user.username, email: `${user.username}@hsg.com` };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 小时
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
});
