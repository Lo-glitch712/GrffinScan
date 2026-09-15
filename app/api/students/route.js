import { NextResponse } from "next/server";
import { saveStudent } from "../../lib/db";

export const POST = async (req) => {
  try {
    const body = await req.json();
    const { id, lastname, firstname, course, yearSection } = body;

    if (!lastname || !firstname || !course || !yearSection) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const data = await saveStudent({
      id,
      lastname,
      firstname,
      course,
      yearsection: yearSection,
    });

    return NextResponse.json({ message: "Student saved successfully", data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
};
