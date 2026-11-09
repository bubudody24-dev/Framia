//! Bucket fill core for Framia, compiled to WebAssembly.
//!
//! The algorithm mirrors the JavaScript fallback in `src/fr.js` exactly:
//! a scanline flood fill over pixels close to the clicked colour, two dilation
//! passes that tuck the colour under the antialiased stroke fringe without
//! eating the stroke itself, and a bounded growth through the soft fringe so
//! narrow tips (sharp triangle corners) stop leaving pale slivers.
//!
//! Memory contract: the caller allocates `w * h * 4` bytes with `alloc`, writes
//! RGBA pixels into it, calls `fill`, and reads the pixels back in place.

use core::slice;

/// Allocate `len` bytes for the caller and hand over the pointer.
#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut buf = Vec::<u8>::with_capacity(len);
    let ptr = buf.as_mut_ptr();
    core::mem::forget(buf);
    ptr
}

/// Release a buffer previously returned by `alloc`.
#[no_mangle]
pub extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }
    unsafe {
        drop(Vec::from_raw_parts(ptr, 0, len));
    }
}

#[inline]
fn distance(px: &[u8], seed: [u8; 4]) -> i32 {
    (px[0] as i32 - seed[0] as i32).abs()
        + (px[1] as i32 - seed[1] as i32).abs()
        + (px[2] as i32 - seed[2] as i32).abs()
        + (px[3] as i32 - seed[3] as i32).abs()
}

/// Flood fill from `(x, y)` with `color`, returning the number of painted pixels.
#[no_mangle]
pub extern "C" fn fill(
    ptr: *mut u8,
    width: usize,
    height: usize,
    x: i32,
    y: i32,
    red: u8,
    green: u8,
    blue: u8,
    alpha: u8,
    tolerance: i32,
    grow_passes: i32,
) -> i32 {
    if ptr.is_null() || width == 0 || height == 0 {
        return 0;
    }
    let len = width * height * 4;
    let pixels = unsafe { slice::from_raw_parts_mut(ptr, len) };
    let (w, h) = (width, height);
    let (sx, sy) = (x, y);
    if sx < 0 || sy < 0 || sx as usize >= w || sy as usize >= h {
        return 0;
    }

    let seed_index = (sy as usize * w + sx as usize) * 4;
    let seed = [
        pixels[seed_index],
        pixels[seed_index + 1],
        pixels[seed_index + 2],
        pixels[seed_index + 3],
    ];

    let mut mask = vec![0u8; w * h];
    let mut stack: Vec<usize> = Vec::with_capacity(1024);
    stack.push(sy as usize * w + sx as usize);

    // Scanline flood fill: walk each row as far as the colour matches.
    while let Some(index) = stack.pop() {
        if mask[index] == 1 {
            continue;
        }
        if distance(&pixels[index * 4..index * 4 + 4], seed) > tolerance {
            continue;
        }
        let row = index / w;
        let mut left = index % w;
        let mut right = left;
        while left > 0
            && mask[row * w + left - 1] == 0
            && distance(&pixels[(row * w + left - 1) * 4..][..4], seed) <= tolerance
        {
            left -= 1;
        }
        while right < w - 1
            && mask[row * w + right + 1] == 0
            && distance(&pixels[(row * w + right + 1) * 4..][..4], seed) <= tolerance
        {
            right += 1;
        }
        for column in left..=right {
            let cell = row * w + column;
            mask[cell] = 1;
            if row > 0 {
                let up = cell - w;
                if mask[up] == 0 && distance(&pixels[up * 4..up * 4 + 4], seed) <= tolerance {
                    stack.push(up);
                }
            }
            if row < h - 1 {
                let down = cell + w;
                if mask[down] == 0 && distance(&pixels[down * 4..down * 4 + 4], seed) <= tolerance {
                    stack.push(down);
                }
            }
        }
    }

    let painted: usize = mask.iter().map(|&v| v as usize).sum();
    if painted == 0 {
        return 0;
    }

    // Dilation: reach under the stroke fringe, never into its opaque core.
    for _ in 0..grow_passes.max(0) {
        let previous = mask.clone();
        for row in 0..h {
            for column in 0..w {
                let cell = row * w + column;
                if previous[cell] == 1 {
                    continue;
                }
                let touching = (row > 0 && previous[cell - w] == 1)
                    || (row < h - 1 && previous[cell + w] == 1)
                    || (column > 0 && previous[cell - 1] == 1)
                    || (column < w - 1 && previous[cell + 1] == 1);
                if !touching {
                    continue;
                }
                let px = &pixels[cell * 4..cell * 4 + 4];
                let gap = (px[0] as i32 - seed[0] as i32).abs()
                    + (px[1] as i32 - seed[1] as i32).abs()
                    + (px[2] as i32 - seed[2] as i32).abs();
                if px[3] > 210 && gap > 240 {
                    continue;
                }
                mask[cell] = 1;
            }
        }
    }

    // Soft growth through the pale fringe, so narrow tips fill completely.
    let soft = |cell: usize| distance(&pixels[cell * 4..cell * 4 + 4], seed) <= 200;
    let mut frontier: Vec<usize> = Vec::new();
    for cell in 0..mask.len() {
        if mask[cell] == 0 {
            continue;
        }
        let row = cell / w;
        let column = cell % w;
        if (row > 0 && mask[cell - w] == 0 && soft(cell - w))
            || (row < h - 1 && mask[cell + w] == 0 && soft(cell + w))
            || (column > 0 && mask[cell - 1] == 0 && soft(cell - 1))
            || (column < w - 1 && mask[cell + 1] == 0 && soft(cell + 1))
        {
            frontier.push(cell);
        }
    }
    let mut layers = 0;
    while !frontier.is_empty() && layers < 32 {
        let mut next: Vec<usize> = Vec::new();
        for cell in frontier {
            let row = cell / w;
            let column = cell % w;
            if row > 0 && mask[cell - w] == 0 && soft(cell - w) {
                mask[cell - w] = 1;
                next.push(cell - w);
            }
            if row < h - 1 && mask[cell + w] == 0 && soft(cell + w) {
                mask[cell + w] = 1;
                next.push(cell + w);
            }
            if column > 0 && mask[cell - 1] == 0 && soft(cell - 1) {
                mask[cell - 1] = 1;
                next.push(cell - 1);
            }
            if column < w - 1 && mask[cell + 1] == 0 && soft(cell + 1) {
                mask[cell + 1] = 1;
                next.push(cell + 1);
            }
        }
        frontier = next;
        layers += 1;
    }

    let mut count = 0i32;
    for cell in 0..mask.len() {
        if mask[cell] == 0 {
            continue;
        }
        let offset = cell * 4;
        pixels[offset] = red;
        pixels[offset + 1] = green;
        pixels[offset + 2] = blue;
        pixels[offset + 3] = alpha;
        count += 1;
    }
    count
}
