"use client";
import ReactPlayerLib from "react-player";
import { forwardRef } from "react";

const ReactPlayerWrapper = forwardRef<any, any>((props, ref) => (
    <ReactPlayerLib ref={ref} {...props} />
));
ReactPlayerWrapper.displayName = "ReactPlayerWrapper";
export default ReactPlayerWrapper;
