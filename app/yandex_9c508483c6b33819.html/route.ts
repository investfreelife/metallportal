import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse(
    `<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    </head>
    <body>Verification: 9c508483c6b33819</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
      },
    }
  );
}
