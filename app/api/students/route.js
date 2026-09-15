import { NextResponse } from "next/server";

export const POST = async (req) => {
  try {
    const body = await req.json();
    const { lastname, firstname, course, yearSection } = body;

    if (!lastname || !firstname || !course || !yearSection) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    return NextResponse.json({
      message: "Student saved locally in the browser. This API is unused for now.",
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
};
