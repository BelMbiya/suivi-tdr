import { NextResponse } from "next/server";

type ApiError = {
  field?: string;
  message: string;
};

export function ok<T>(
  data: T,
  message = "Operation successful",
  init?: ResponseInit,
) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    init,
  );
}

export function created<T>(data: T, message = "Resource created") {
  return ok(data, message, { status: 201 });
}

export function fail(
  message = "Operation failed",
  errors: ApiError[] = [],
  status = 400,
) {
  return NextResponse.json(
    {
      success: false,
      message,
      errors,
    },
    { status },
  );
}
