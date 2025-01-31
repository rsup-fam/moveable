import { PREFIX } from "./consts";
import { prefixNames } from "framework-utils";
import { splitBracket, isUndefined, isObject } from "@daybrush/utils";
import { MoveableState, MoveableProps } from "./types";
import {
    multiply, invert,
    convertCSStoMatrix, convertMatrixtoCSS,
    convertDimension, createIdentityMatrix,
    createOriginMatrix, convertPositionMatrix, caculate,
} from "./matrix";

export function prefix(...classNames: string[]) {
    return prefixNames(PREFIX, ...classNames);
}

export function getTransform(target: SVGElement | HTMLElement, isInit: true): number[];
export function getTransform(target: SVGElement | HTMLElement): "none" | number[];
export function getTransform(target: SVGElement | HTMLElement, isInit?: boolean) {
    const transform = window.getComputedStyle(target).transform!;

    if (transform === "none" && !isInit) {
        return "none";
    }
    return getTransformMatrix(transform);
}
export function getOriginMatrix(el: HTMLElement | SVGElement, n: number, parentOrigin: number[]) {
    return createOriginMatrix(n, [
        (el as any).offsetLeft - parentOrigin[0],
        (el as any).offsetTop - parentOrigin[1],
    ]);

}
export function getTransformMatrix(transform: string | number[]) {
    if (transform === "none") {
        return [1, 0, 0, 1, 0, 0];
    }
    if (isObject(transform)) {
        return transform;
    }
    const value = splitBracket(transform).value!;
    return value.split(/s*,\s*/g).map(v => parseFloat(v));
}

export function caculateMatrixStack(
    target: SVGElement | HTMLElement,
    container: SVGElement | HTMLElement | null | undefined,
    prevMatrix?: number[],
    prevN?: number,
): [number[], number[], number[], number[], string, number[]] {
    let el: SVGElement | HTMLElement | null = target;
    let style: CSSStyleDeclaration | null = window.getComputedStyle(el);
    const transformOrigin = style.transformOrigin!.split(" ").map(pos => parseFloat(pos));
    const totalTransformOrigin = [0, 0];
    const matrixes: number[][] = [];
    const isContainer = el === container;
    let is3d = false;

    while (el && (isContainer || el !== container)) {
        let matrix = convertCSStoMatrix(getTransformMatrix(style!.transform!));

        if (is3d && matrix.length === 9) {
            matrix = convertDimension(matrix, 3, 4);
        }
        matrixes.push(matrix);
        if (!is3d && matrix.length === 16) {
            is3d = true;
            const matrixesLength = matrixes.length - 1;

            for (let i = 0; i < matrixesLength; ++i) {
                matrixes[i] = convertDimension(matrixes[i], 3, 4);
            }
        }
        const parentElement: HTMLElement | null = el.parentElement;
        style = parentElement ? window.getComputedStyle(parentElement) : null;
        const parentOrigin = style ? style.transformOrigin!.split(" ").map(pos => parseFloat(pos)) : [0, 0];
        const m = getOriginMatrix(el, is3d ? 4 : 3, parentOrigin);

        matrixes.push(m);
        if (isContainer) {
            break;
        }
        totalTransformOrigin[0] += parentOrigin[0];
        totalTransformOrigin[1] += parentOrigin[1];
        el = parentElement;
    }
    const n = is3d ? 4 : 3;
    const targetMatrix = matrixes[0] || createIdentityMatrix(n);

    let mat = prevMatrix ? convertDimension(prevMatrix, prevN, n) : createIdentityMatrix(n);
    let beforeMatrix = createIdentityMatrix(n);
    let offsetMatrix = createIdentityMatrix(n);

    matrixes.push(createOriginMatrix(n, totalTransformOrigin));
    const length = matrixes.length;
    matrixes.reverse();
    matrixes.forEach((matrix, i) => {
        if (length - 2 === i) {
            beforeMatrix = mat.slice();
        }
        if (length - 1 === i) {
            offsetMatrix = mat.slice();
        }
        mat = multiply(
            mat,
            matrix,
            n,
        );
    });
    const transform = `${is3d ? "matrix3d" : "matrix"}(${convertMatrixtoCSS(targetMatrix)})`;

    const absoluteMatrix = multiply(
        offsetMatrix,
        multiply(
            createOriginMatrix(n, transformOrigin),
            multiply(
                targetMatrix,
                createOriginMatrix(n, transformOrigin.map(a => -a)),
                n,
            ),
            n,
        ),
        n,
    );

    return [beforeMatrix, mat, targetMatrix, absoluteMatrix, transform, transformOrigin];
}
export function caculatePosition(matrix: number[], origin: number[], width: number, height: number) {
    const is3d = matrix.length === 16;
    const n = is3d ? 4 : 3;
    let [x1, y1] = caculate(matrix, convertPositionMatrix([0, 0], n), n);
    let [x2, y2] = caculate(matrix, convertPositionMatrix([width, 0], n), n);
    let [x3, y3] = caculate(matrix, convertPositionMatrix([0, height], n), n);
    let [x4, y4] = caculate(matrix, convertPositionMatrix([width, height], n), n);
    let [originX, originY] = caculate(matrix, convertPositionMatrix(origin, n), n);

    const minX = Math.min(x1, x2, x3, x4);
    const minY = Math.min(y1, y2, y3, y4);

    x1 = (x1 - minX) || 0;
    x2 = (x2 - minX) || 0;
    x3 = (x3 - minX) || 0;
    x4 = (x4 - minX) || 0;

    y1 = (y1 - minY) || 0;
    y2 = (y2 - minY) || 0;
    y3 = (y3 - minY) || 0;
    y4 = (y4 - minY) || 0;

    originX = (originX - minX) || 0;
    originY = (originY - minY) || 0;

    return [
        [minX, minY],
        [originX, originY],
        [x1, y1],
        [x2, y2],
        [x3, y3],
        [x4, y4],
    ];
}

export function rotateMatrix(matrix: number[], rad: number) {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    return multiply([
        cos, -sin, 0,
        sin, cos, 0,
        0, 0, 1,
    ], matrix, 3);
}
export function getRad(pos1: number[], pos2: number[]) {
    const distX = pos2[0] - pos1[0];
    const distY = pos2[1] - pos1[1];
    const rad = Math.atan2(distY, distX);

    return rad > 0 ? rad : rad + Math.PI * 2;
}
export function getLineStyle(pos1: number[], pos2: number[]) {
    const distX = pos2[0] - pos1[0];
    const distY = pos2[1] - pos1[1];
    const width = Math.sqrt(distX * distX + distY * distY);
    const rad = getRad(pos1, pos2);

    return {
        transform: `translate(${pos1[0]}px, ${pos1[1]}px) rotate(${rad}rad)`,
        width: `${width}px`,
    };
}
export function getControlTransform(...poses: number[][]) {
    const length = poses.length;

    const x = poses.reduce((prev, pos) => prev + pos[0], 0) / length;
    const y = poses.reduce((prev, pos) => prev + pos[1], 0) / length;
    return {
        transform: `translate(${x}px, ${y}px)`,
    };
}
export function getSize(
    target: SVGElement | HTMLElement,
    style: CSSStyleDeclaration = window.getComputedStyle(target),
    isOffset?: boolean,
    isBoxSizing: boolean = isOffset || style.boxSizing === "border-box",
) {
    let width = (target as HTMLElement).offsetWidth;
    let height = (target as HTMLElement).offsetHeight;
    const hasOffset = !isUndefined(width);

    if ((isOffset || isBoxSizing) && hasOffset) {
        return [width, height];
    }
    width = target.clientWidth;
    height = target.clientHeight;

    if (isOffset || isBoxSizing) {
        const borderLeft = parseFloat(style.borderLeftWidth!) || 0;
        const borderRight = parseFloat(style.borderRightWidth!) || 0;
        const borderTop = parseFloat(style.borderTopWidth!) || 0;
        const borderBottom = parseFloat(style.borderBottomWidth!) || 0;

        return [
            width + borderLeft + borderRight,
            height + borderTop + borderBottom,
        ];
    } else {
        const paddingLeft = parseFloat(style.paddingLeft!) || 0;
        const paddingRight = parseFloat(style.paddingRight!) || 0;
        const paddingTop = parseFloat(style.paddingTop!) || 0;
        const paddingBottom = parseFloat(style.paddingBottom!) || 0;

        return [
            width - paddingLeft - paddingRight,
            height - paddingTop - paddingBottom,
        ];
    }
}
export function getRotationInfo(
    pos1: number[],
    pos2: number[],
    pos3: number[],
    pos4: number[],
): [1 | -1, number, number[]] {
    const center = [
        (pos1[0] + pos2[0] + pos3[0] + pos4[0]) / 4,
        (pos1[1] + pos2[1] + pos3[1] + pos4[1]) / 4,
    ];
    const pos1Rad = getRad(center, pos1);
    const pos2Rad = getRad(center, pos2);
    const direction =
        (pos1Rad < pos2Rad && pos2Rad - pos1Rad < Math.PI) || (pos1Rad > pos2Rad && pos2Rad - pos1Rad < -Math.PI)
            ? 1 : -1;
    const rotationRad = getRad(direction > 0 ? pos1 : pos2, direction > 0 ? pos2 : pos1);
    const relativeRotationPos = rotateMatrix([0, -40, 0], rotationRad);

    const rotationPos = [
        (pos1[0] + pos2[0]) / 2 + relativeRotationPos[0],
        (pos1[1] + pos2[1]) / 2 + relativeRotationPos[1],
    ];

    return [direction, rotationRad, rotationPos];
}
export function getTargetInfo(
    target?: MoveableProps["target"],
    container?: MoveableProps["container"],
): MoveableState {
    let left = 0;
    let top = 0;
    let origin = [0, 0];
    let pos1 = [0, 0];
    let pos2 = [0, 0];
    let pos3 = [0, 0];
    let pos4 = [0, 0];
    let beforeMatrix = createIdentityMatrix(3);
    let matrix = createIdentityMatrix(3);
    let targetMatrix = createIdentityMatrix(3);
    let absoluteMatrix = createIdentityMatrix(3);
    let width = 0;
    let height = 0;
    let transformOrigin = [0, 0];
    let direction: 1 | -1 = 1;
    let rotationPos = [0, 0];
    let rotationRad = 0;
    let is3d = false;
    let targetTransform = "";

    if (target) {
        const style = window.getComputedStyle(target);

        width = (target as HTMLElement).offsetWidth;
        height = (target as HTMLElement).offsetHeight;

        if (isUndefined(width)) {
            [width, height] = getSize(target, style, true);
        }
        [
            beforeMatrix, matrix,
            targetMatrix, absoluteMatrix,
            targetTransform, transformOrigin,
        ] = caculateMatrixStack(target, container);

        is3d = matrix.length === 16;

        [
            [left, top],
            origin,
            pos1,
            pos2,
            pos3,
            pos4,
        ] = caculatePosition(absoluteMatrix, transformOrigin, width, height);
        // 1 : clockwise
        // -1 : counterclockwise
        [direction, rotationRad, rotationPos] = getRotationInfo(pos1, pos2, pos3, pos4);
    }

    return {
        direction,
        rotationRad,
        rotationPos,
        target,
        left,
        top,
        pos1,
        pos2,
        pos3,
        pos4,
        width,
        height,
        beforeMatrix,
        matrix,
        absoluteMatrix,
        targetTransform,
        targetMatrix,
        is3d,
        origin,
        transformOrigin,
    };
}

export function getPosition(target: SVGElement | HTMLElement) {
    const position = target.getAttribute("data-position")!;

    if (!position) {
        return;
    }
    const pos = [0, 0];

    (position.indexOf("w") > -1) && (pos[0] = -1);
    (position.indexOf("e") > -1) && (pos[0] = 1);
    (position.indexOf("n") > -1) && (pos[1] = -1);
    (position.indexOf("s") > -1) && (pos[1] = 1);

    return pos;
}

export function throttle(num: number, unit: number) {
    if (!unit) {
        return num;
    }
    return Math.round(num / unit) * unit;
}
export function throttleArray(nums: number[], unit: number) {
    nums.forEach((_, i) => {
        nums[i] = throttle(nums[i], unit);
    });
}

export function warp(
    pos0: number[],
    pos1: number[],
    pos2: number[],
    pos3: number[],
    nextPos0: number[],
    nextPos1: number[],
    nextPos2: number[],
    nextPos3: number[],
) {
    const [x0, y0] = pos0;
    const [x1, y1] = pos1;
    const [x2, y2] = pos2;
    const [x3, y3] = pos3;

    const [u0, v0] = nextPos0;
    const [u1, v1] = nextPos1;
    const [u2, v2] = nextPos2;
    const [u3, v3] = nextPos3;

    const matrix = [
        x0, y0, 1, 0, 0, 0, -u0 * x0, -u0 * y0,
        0, 0, 0, x0, y0, 1, -v0 * x0, -v0 * y0,
        x1, y1, 1, 0, 0, 0, -u1 * x1, -u1 * y1,
        0, 0, 0, x1, y1, 1, -v1 * x1, -v1 * y1,
        x2, y2, 1, 0, 0, 0, -u2 * x2, -u2 * y2,
        0, 0, 0, x2, y2, 1, -v2 * x2, -v2 * y2,
        x3, y3, 1, 0, 0, 0, -u3 * x3, -u3 * y3,
        0, 0, 0, x3, y3, 1, -v3 * x3, -v3 * y3,
    ];
    const inverseMatrix = invert(matrix, 8);

    if (!inverseMatrix.length) {
        return [];
    }
    const h = multiply(inverseMatrix, [u0, v0, u1, v1, u2, v2, u3, v3], 8);

    h[8] = 1;
    return convertDimension(h, 3, 4);
}

export function getTargetPosition(target: HTMLElement | SVGElement, container?: HTMLElement | SVGElement | null) {
    const rect = target.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;

    if (container) {
        const containerRect = container.getBoundingClientRect();

        left -= containerRect.left;
        top -= containerRect.top;
    }
    return {
        left,
        top,
    };
}
