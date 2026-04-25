import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse(
`<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    </head>
    <body>Verification: f5e25a2708758d3e</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
      },
    }
  );
}
