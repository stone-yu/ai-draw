// ============================================================================
// XML Validation/Fix Constants
// ============================================================================

/** Maximum XML size to process (1MB) - larger XMLs may cause performance issues */
const MAX_XML_SIZE = 1_000_000

/** Maximum iterations for aggressive cell dropping to prevent infinite loops */
// const MAX_DROP_ITERATIONS = 10

/** Structural attributes that should not be duplicated in draw.io */
const STRUCTURAL_ATTRS = [
    "edge",
    "parent",
    "source",
    "target",
    "vertex",
    "connectable",
]

/** Valid XML entity names */
const VALID_ENTITIES = new Set(["lt", "gt", "amp", "quot", "apos"])

// ============================================================================
// XML Parsing Helpers
// ============================================================================

interface ParsedTag {
    tag: string
    tagName: string
    isClosing: boolean
    isSelfClosing: boolean
    startIndex: number
    endIndex: number
}

/**
 * Parse XML tags while properly handling quoted strings
 * This is a shared utility used by both validation and fixing logic
 */
function parseXmlTags(xml: string): ParsedTag[] {
    const tags: ParsedTag[] = []
    let i = 0

    while (i < xml.length) {
        const tagStart = xml.indexOf("<", i)
        if (tagStart === -1) break

        // Find matching > by tracking quotes
        let tagEnd = tagStart + 1
        let inQuote = false
        let quoteChar = ""

        while (tagEnd < xml.length) {
            const c = xml[tagEnd]
            if (inQuote) {
                if (c === quoteChar) inQuote = false
            } else {
                if (c === '"' || c === "'") {
                    inQuote = true
                    quoteChar = c
                } else if (c === ">") {
                    break
                }
            }
            tagEnd++
        }

        if (tagEnd >= xml.length) break

        const tag = xml.substring(tagStart, tagEnd + 1)
        i = tagEnd + 1

        const tagMatch = /^<(\/?)([a-zA-Z][a-zA-Z0-9:_-]*)/.exec(tag)
        if (!tagMatch) continue

        tags.push({
            tag,
            tagName: tagMatch[2],
            isClosing: tagMatch[1] === "/",
            isSelfClosing: tag.endsWith("/>"),
            startIndex: tagStart,
            endIndex: tagEnd,
        })
    }

    return tags
}

/**
 * Efficiently converts a potentially incomplete XML string to a legal XML string by closing any open tags properly.
 * Additionally, if an <mxCell> tag does not have an mxGeometry child (e.g. <mxCell id="3">),
 * it removes that tag from the output.
 * Also removes orphaned <mxPoint> elements that aren't inside <Array> or don't have proper 'as' attribute.
 * @param xmlString The potentially incomplete XML string
 * @returns A legal XML string with properly closed tags and removed incomplete mxCell elements.
 */
export function convertToLegalXml(xmlString: string): string {
    // Sanitize raw <br> / <b> etc. inside attribute values first, otherwise the
    // mxCell regex below stops at the first `>` from that pseudo-tag and yields
    // a structurally broken cell.
    xmlString = escapeAttrAngleBrackets(xmlString)
    xmlString = fixUnclosedMxCellTags(xmlString)
    xmlString = dedupeAttributes(xmlString)
    xmlString = flattenNestedMxCells(xmlString)

    // Primary path: if the (cleaned, flattened) input is well-formed XML, just
    // walk the DOM. This avoids the regex's non-greedy `[\s\S]*?` problem where
    // it terminates at the first inner </mxCell> in nested structures and
    // produces unbalanced cell blocks. Only fall back to regex when DOMParser
    // can't make sense of the input (typically partial streaming chunks).
    try {
        const doc = new DOMParser().parseFromString(xmlString, 'text/xml')
        if (doc.getElementsByTagName('parsererror').length === 0) {
            const allCells = Array.from(doc.getElementsByTagName('mxCell'))
            let out = '<root>\n'
            const serializer = new XMLSerializer()
            for (const cell of allCells) {
                if (cell.parentElement?.tagName === 'mxCell') continue
                // Remove orphan <mxPoint> without `as=` outside <Array as="points">.
                const hasArrayPoints = cell.querySelector('Array[as="points"]')
                if (!hasArrayPoints) {
                    const orphans = Array.from(cell.getElementsByTagName('mxPoint'))
                        .filter(p => !p.hasAttribute('as'))
                    for (const p of orphans) p.parentNode?.removeChild(p)
                }
                out += '    ' + serializer.serializeToString(cell) + '\n'
            }
            out += '</root>'
            return out
        }
    } catch { /* fall through to regex path */ }

    // Fallback path (streaming partials etc.): regex-based extraction with the
    // per-cell parse check. Same caveats as before, will drop cells whose
    // nested children make the non-greedy match unbalanced, but we get here
    // only when the input wasn't parseable as a whole anyway.
    const regex = /<mxCell\b[^>]*(?:\/>|>([\s\S]*?)<\/mxCell>)/g
    let match: RegExpExecArray | null
    let result = "<root>\n"

    while ((match = regex.exec(xmlString)) !== null) {
        // match[0] contains the entire matched mxCell block
        let cellContent = match[0]

        // Remove orphaned <mxPoint> elements that are directly inside <mxGeometry>
        // without an 'as' attribute (like as="sourcePoint", as="targetPoint")
        // and not inside <Array as="points">
        // These cause "Could not add object mxPoint" errors in draw.io
        // First check if there's an <Array as="points"> - if so, keep all mxPoints inside it
        const hasArrayPoints = /<Array\s+as="points">/.test(cellContent)
        if (!hasArrayPoints) {
            // Remove mxPoint elements without 'as' attribute
            cellContent = cellContent.replace(
                /<mxPoint\b[^>]*\/>/g,
                (pointMatch) => {
                    // Keep if it has an 'as' attribute
                    if (/\sas=/.test(pointMatch)) {
                        return pointMatch
                    }
                    // Remove orphaned mxPoint
                    return ""
                },
            )
        }

        // Fix unescaped & characters in attribute values (but not valid entities)
        // This prevents DOMParser from failing on content like "semantic & missing-step"
        cellContent = cellContent.replace(
            /&(?!(?:lt|gt|amp|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/g,
            "&amp;",
        )

        // Per-cell parse check: if this single cell is malformed (e.g. unmatched
        // </Array>, stray reserved-name elements), skip it instead of polluting
        // the whole batch and forcing replaceNodes into its empty-fallback path.
        try {
            const test = new DOMParser().parseFromString(`<root>${cellContent}</root>`, 'text/xml')
            if (test.getElementsByTagName('parsererror').length > 0) {
                console.warn('[convertToLegalXml] dropping malformed cell:', cellContent.substring(0, 120))
                continue
            }
        } catch {
            continue
        }

        // Indent each line of the matched block for readability.
        const formatted = cellContent
            .split("\n")
            .map((line) => "    " + line.trim())
            .filter((line) => line.trim()) // Remove empty lines from removed mxPoints
            .join("\n")
        result += formatted + "\n"
    }
    result += "</root>"

    return result
}

/**
 * Replace nodes in a Draw.io XML diagram
 * Preserves the mxGraphModel attributes (dx, dy, etc.) from currentXML
 * and replaces the content of <root> with nodes from the new XML.
 *
 * @param currentXML - The original Draw.io XML string (base)
 * @param nodes - The XML string containing new nodes to replace in the diagram
 * @returns The updated XML string with replaced nodes
 */
export function replaceNodes(currentXML: string, nodes: string): string {
    // Check for valid inputs
    if (!currentXML || !nodes) {
        // If currentXML is empty, just return nodes (wrapped if needed)
        if (!currentXML && nodes) return nodes;
        return currentXML;
    }

    try {
        // Parse the XML strings to create DOM objects
        const parser = new DOMParser()
        const currentDoc = parser.parseFromString(currentXML, "text/xml")

        // Handle nodes input - if it doesn't contain <root>, wrap it
        let nodesString = nodes
        if (!nodes.includes("<root>") && !nodes.includes("<mxGraphModel>")) {
            nodesString = `<root>${nodes}</root>`
        } else if (nodes.includes("<mxGraphModel>") && !nodes.includes("<root>")) {
             // Should not happen for valid drawio XML, but handle edge case
        }

        const nodesDoc = parser.parseFromString(nodesString, "text/xml")

        // Find the root element in the current document
        let currentRoot = currentDoc.querySelector("mxGraphModel > root")
        if (!currentRoot) {
            // If no root element is found, create the proper structure
            const mxGraphModel =
                currentDoc.querySelector("mxGraphModel") ||
                currentDoc.createElement("mxGraphModel")

            if (!currentDoc.contains(mxGraphModel)) {
                currentDoc.appendChild(mxGraphModel)
            }

            currentRoot = currentDoc.createElement("root")
            mxGraphModel.appendChild(currentRoot)
        }

        // Find the root element in the nodes document
        // It could be directly <root> or inside <mxGraphModel>
        let nodesRoot = nodesDoc.querySelector("root")
        if (!nodesRoot) {
             // Try to find mxGraphModel > root
             nodesRoot = nodesDoc.querySelector("mxGraphModel > root")
        }

        if (!nodesRoot) {
            // If still not found, maybe the nodes string IS the content of root?
            // But we wrapped it in <root> above if it didn't have it.
            // If nodes was just <mxCell...>, it's now <root><mxCell...></root>
            // So nodesRoot should be found.
            // If nodes was <mxGraphModel>...</mxGraphModel> but missing root, that's invalid.

            // Fallback: if nodesDoc has mxCells at top level (invalid XML but possible from parser)
            const cells = nodesDoc.querySelectorAll("mxCell")
            if (cells.length > 0) {
                // Create a temp root
                nodesRoot = nodesDoc.createElement("root")
                cells.forEach(cell => nodesRoot!.appendChild(cell.cloneNode(true)))
            } else {
                 throw new Error("Invalid nodes: Could not find or create <root> element")
            }
        }

        // Clear all existing child elements from the current root
        while (currentRoot.firstChild) {
            currentRoot.removeChild(currentRoot.firstChild)
        }

        // Ensure the base cells exist
        const hasCell0 = Array.from(nodesRoot.childNodes).some(
            (node) =>
                node.nodeName === "mxCell" &&
                (node as Element).getAttribute("id") === "0",
        )

        const hasCell1 = Array.from(nodesRoot.childNodes).some(
            (node) =>
                node.nodeName === "mxCell" &&
                (node as Element).getAttribute("id") === "1",
        )

        // Copy all child nodes from the nodes root to the current root
        Array.from(nodesRoot.childNodes).forEach((node) => {
            const importedNode = currentDoc.importNode(node, true)
            currentRoot!.appendChild(importedNode)
        })

        // Add default cells if they don't exist
        if (!hasCell0) {
            const cell0 = currentDoc.createElement("mxCell")
            cell0.setAttribute("id", "0")
            currentRoot.insertBefore(cell0, currentRoot.firstChild)
        }

        if (!hasCell1) {
            const cell1 = currentDoc.createElement("mxCell")
            cell1.setAttribute("id", "1")
            cell1.setAttribute("parent", "0")

            // Insert after cell0 if possible
            const cell0 = currentRoot.querySelector('mxCell[id="0"]')
            if (cell0?.nextSibling) {
                currentRoot.insertBefore(cell1, cell0.nextSibling)
            } else {
                currentRoot.appendChild(cell1)
            }
        }

        // Convert the modified DOM back to a string
        const serializer = new XMLSerializer()
        return serializer.serializeToString(currentDoc)
    } catch (error) {
        console.error("Error replacing nodes:", error)
        // Fallback: return currentXML to maintain valid state
        return currentXML
    }
}

// ============================================================================
// Validation Helper Functions
// ============================================================================

/** Check for duplicate structural attributes in a tag */
function checkDuplicateAttributes(xml: string): string | null {
    const structuralSet = new Set(STRUCTURAL_ATTRS)
    const tagPattern = /<[^>]+>/g
    let tagMatch
    while ((tagMatch = tagPattern.exec(xml)) !== null) {
        const tag = tagMatch[0]
        const attrPattern = /\s([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*=/g
        const attributes = new Map<string, number>()
        let attrMatch
        while ((attrMatch = attrPattern.exec(tag)) !== null) {
            const attrName = attrMatch[1]
            attributes.set(attrName, (attributes.get(attrName) || 0) + 1)
        }
        const duplicates = Array.from(attributes.entries())
            .filter(([name, count]) => count > 1 && structuralSet.has(name))
            .map(([name]) => name)
        if (duplicates.length > 0) {
            return `Invalid XML: Duplicate structural attribute(s): ${duplicates.join(", ")}. Remove duplicate attributes.`
        }
    }
    return null
}

/** Check for duplicate IDs in XML */
function checkDuplicateIds(xml: string): string | null {
    const idPattern = /\bid\s*=\s*["']([^"']+)["']/gi
    const ids = new Map<string, number>()
    let idMatch
    while ((idMatch = idPattern.exec(xml)) !== null) {
        const id = idMatch[1]
        ids.set(id, (ids.get(id) || 0) + 1)
    }
    const duplicateIds = Array.from(ids.entries())
        .filter(([, count]) => count > 1)
        .map(([id, count]) => `'${id}' (${count}x)`)
    if (duplicateIds.length > 0) {
        return `Invalid XML: Found duplicate ID(s): ${duplicateIds.slice(0, 3).join(", ")}. All id attributes must be unique.`
    }
    return null
}

/** Check for tag mismatches using parsed tags */
function checkTagMismatches(xml: string): string | null {
    const xmlWithoutComments = xml.replace(/<!--[\s\S]*?-->/g, "")
    const tags = parseXmlTags(xmlWithoutComments)
    const tagStack: string[] = []

    for (const { tagName, isClosing, isSelfClosing } of tags) {
        if (isClosing) {
            if (tagStack.length === 0) {
                return `Invalid XML: Closing tag </${tagName}> without matching opening tag`
            }
            const expected = tagStack.pop()
            if (expected?.toLowerCase() !== tagName.toLowerCase()) {
                return `Invalid XML: Expected closing tag </${expected}> but found </${tagName}>`
            }
        } else if (!isSelfClosing) {
            tagStack.push(tagName)
        }
    }
    if (tagStack.length > 0) {
        return `Invalid XML: Document has ${tagStack.length} unclosed tag(s): ${tagStack.join(", ")}`
    }
    return null
}

/** Check for invalid character references */
function checkCharacterReferences(xml: string): string | null {
    const charRefPattern = /&#x?[^;]+;?/g
    let charMatch
    while ((charMatch = charRefPattern.exec(xml)) !== null) {
        const ref = charMatch[0]
        if (ref.startsWith("&#x")) {
            if (!ref.endsWith(";")) {
                return `Invalid XML: Missing semicolon after hex reference: ${ref}`
            }
            const hexDigits = ref.substring(3, ref.length - 1)
            if (hexDigits.length === 0 || !/^[0-9a-fA-F]+$/.test(hexDigits)) {
                return `Invalid XML: Invalid hex character reference: ${ref}`
            }
        } else if (ref.startsWith("&#")) {
            if (!ref.endsWith(";")) {
                return `Invalid XML: Missing semicolon after decimal reference: ${ref}`
            }
            const decDigits = ref.substring(2, ref.length - 1)
            if (decDigits.length === 0 || !/^[0-9]+$/.test(decDigits)) {
                return `Invalid XML: Invalid decimal character reference: ${ref}`
            }
        }
    }
    return null
}

/** Check for invalid entity references */
function checkEntityReferences(xml: string): string | null {
    const xmlWithoutComments = xml.replace(/<!--[\s\S]*?-->/g, "")
    const bareAmpPattern = /&(?!(?:lt|gt|amp|quot|apos|#))/g
    if (bareAmpPattern.test(xmlWithoutComments)) {
        return "Invalid XML: Found unescaped & character(s). Replace & with &amp;"
    }
    const invalidEntityPattern = /&([a-zA-Z][a-zA-Z0-9]*);/g
    let entityMatch
    while (
        (entityMatch = invalidEntityPattern.exec(xmlWithoutComments)) !== null
    ) {
        if (!VALID_ENTITIES.has(entityMatch[1])) {
            return `Invalid XML: Invalid entity reference: &${entityMatch[1]}; - use only valid XML entities (lt, gt, amp, quot, apos)`
        }
    }
    return null
}

/** Check for nested mxCell tags using regex */
function checkNestedMxCells(xml: string): string | null {
    const cellTagPattern = /<\/?mxCell[^>]*>/g
    const cellStack: number[] = []
    let cellMatch
    while ((cellMatch = cellTagPattern.exec(xml)) !== null) {
        const tag = cellMatch[0]
        if (tag.startsWith("</mxCell>")) {
            if (cellStack.length > 0) cellStack.pop()
        } else if (!tag.endsWith("/>")) {
            const isLabelOrGeometry =
                /\sas\s*=\s*["'](valueLabel|geometry)["']/.test(tag)
            if (!isLabelOrGeometry) {
                cellStack.push(cellMatch.index)
                if (cellStack.length > 1) {
                    return "Invalid XML: Found nested mxCell tags. Cells should be siblings, not nested inside other mxCell elements."
                }
            }
        }
    }
    return null
}

/**
 * Validates draw.io XML structure for common issues
 * Uses DOM parsing + additional regex checks for high accuracy
 * @param xml - The XML string to validate
 * @returns null if valid, error message string if invalid
 */
export function validateMxCellStructure(xml: string): string | null {
    // Size check for performance
    if (xml.length > MAX_XML_SIZE) {
        console.warn(
            `[validateMxCellStructure] XML size (${xml.length}) exceeds ${MAX_XML_SIZE} bytes, may cause performance issues`,
        )
    }

    // 0. First use DOM parser to catch syntax errors (most accurate)
    try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(xml, "text/xml")
        const parseError = doc.querySelector("parsererror")
        if (parseError) {
            // const actualError = parseError.textContent || "Unknown parse error"
            return `Invalid XML: The XML contains syntax errors (likely unescaped special characters like <, >, & in attribute values). Please escape special characters: use &lt; for <, &gt; for >, &amp; for &, &quot; for ". Regenerate the diagram with properly escaped values.`
        }

        // DOM-based checks for nested mxCell
        const allCells = doc.querySelectorAll("mxCell")
        for (const cell of allCells) {
            if (cell.parentElement?.tagName === "mxCell") {
                const id = cell.getAttribute("id") || "unknown"
                return `Invalid XML: Found nested mxCell (id="${id}"). Cells should be siblings, not nested inside other mxCell elements.`
            }
        }
    } catch (error) {
        console.warn(
            "[validateMxCellStructure] DOMParser threw unexpected error, falling back to regex validation:",
            error,
        )
    }

    // 1. Check for CDATA wrapper (invalid at document root)
    if (/^\s*<!\[CDATA\[/.test(xml)) {
        return "Invalid XML: XML is wrapped in CDATA section - remove <![CDATA[ from start and ]]> from end"
    }

    // 2. Check for duplicate structural attributes
    const dupAttrError = checkDuplicateAttributes(xml)
    if (dupAttrError) return dupAttrError

    // 3. Check for unescaped < in attribute values
    const attrValuePattern = /=\s*"([^"]*)"/g
    let attrValMatch
    while ((attrValMatch = attrValuePattern.exec(xml)) !== null) {
        const value = attrValMatch[1]
        if (/</.test(value) && !/&lt;/.test(value)) {
            return "Invalid XML: Unescaped < character in attribute values. Replace < with &lt;"
        }
    }

    // 4. Check for duplicate IDs
    const dupIdError = checkDuplicateIds(xml)
    if (dupIdError) return dupIdError

    // 5. Check for tag mismatches
    const tagMismatchError = checkTagMismatches(xml)
    if (tagMismatchError) return tagMismatchError

    // 6. Check invalid character references
    const charRefError = checkCharacterReferences(xml)
    if (charRefError) return charRefError

    // 7. Check for invalid comment syntax (-- inside comments)
    const commentPattern = /<!--([\s\S]*?)-->/g
    let commentMatch
    while ((commentMatch = commentPattern.exec(xml)) !== null) {
        if (/--/.test(commentMatch[1])) {
            return "Invalid XML: Comment contains -- (double hyphen) which is not allowed"
        }
    }

    // 8. Check for unescaped entity references and invalid entity names
    const entityError = checkEntityReferences(xml)
    if (entityError) return entityError

    // 9. Check for empty id attributes on mxCell
    if (/<mxCell[^>]*\sid\s*=\s*["']\s*["'][^>]*>/g.test(xml)) {
        return "Invalid XML: Found mxCell element(s) with empty id attribute"
    }

    // 10. Check for nested mxCell tags
    const nestedCellError = checkNestedMxCells(xml)
    if (nestedCellError) return nestedCellError

    return null
}

/**
 * Attempts to auto-fix common XML issues in draw.io diagrams
 * @param xml - The XML string to fix
 * @returns Object with fixed XML and list of fixes applied
 */
export function autoFixXml(xml: string): { fixed: string; fixes: string[] } {
    let fixed = xml
    const fixes: string[] = []

    // 0. Fix JSON-escaped XML
    if (/=\\"/.test(fixed)) {
        fixed = fixed.replace(/\\"/g, '"')
        fixed = fixed.replace(/\\n/g, "\n")
        fixes.push("Fixed JSON-escaped XML")
    }

    // 0.1. Fix common line break issues
    const lineBreakFixed = fixed.replace(
        /value="([^"]*?\\n[^"]*?)"/g,
        (match, content) => {
            const withBreaks = content.replace(/\\n/g, "&#xa;")
            return `value="${withBreaks}"`
        },
    )

    if (lineBreakFixed !== fixed) {
        fixed = lineBreakFixed
        fixes.push("Fixed line breaks in text content")
    }

    // 1. Remove CDATA wrapper
    if (/^\s*<!\[CDATA\[/.test(fixed)) {
        fixed = fixed.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "")
        fixes.push("Removed CDATA wrapper")
    }

    // 2. Remove text before XML declaration or root element
    const xmlStart = fixed.search(/<(\?xml|mxGraphModel|mxfile)/i)
    if (xmlStart > 0 && !/^<[a-zA-Z]/.test(fixed.trim())) {
        fixed = fixed.substring(xmlStart)
        fixes.push("Removed text before XML root")
    }

    // 2. Fix duplicate attributes
    let dupAttrFixed = false
    fixed = fixed.replace(/<[^>]+>/g, (tag) => {
        let newTag = tag
        for (const attr of STRUCTURAL_ATTRS) {
            const attrRegex = new RegExp(
                `\\s${attr}\\s*=\\s*["'][^"']*["']`,
                "gi",
            )
            const matches = tag.match(attrRegex)
            if (matches && matches.length > 1) {
                let firstKept = false
                newTag = newTag.replace(attrRegex, (m) => {
                    if (!firstKept) {
                        firstKept = true
                        return m
                    }
                    dupAttrFixed = true
                    return ""
                })
            }
        }
        return newTag
    })
    if (dupAttrFixed) {
        fixes.push("Removed duplicate structural attributes")
    }

    // 3. Fix unescaped & characters
    const ampersandPattern =
        /&(?!(?:lt|gt|amp|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/g
    if (ampersandPattern.test(fixed)) {
        fixed = fixed.replace(
            /&(?!(?:lt|gt|amp|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/g,
            "&amp;",
        )
        fixes.push("Escaped unescaped & characters")
    }

    // 3. Fix invalid entity names
    const invalidEntities = [
        { pattern: /&ampquot;/g, replacement: "&quot;", name: "&ampquot;" },
        { pattern: /&amplt;/g, replacement: "&lt;", name: "&amplt;" },
        { pattern: /&ampgt;/g, replacement: "&gt;", name: "&ampgt;" },
        { pattern: /&ampapos;/g, replacement: "&apos;", name: "&ampapos;" },
        { pattern: /&ampamp;/g, replacement: "&amp;", name: "&ampamp;" },
    ]
    for (const { pattern, replacement, name } of invalidEntities) {
        if (pattern.test(fixed)) {
            fixed = fixed.replace(pattern, replacement)
            fixes.push(`Fixed double-escaped entity ${name}`)
        }
    }

    // 3b. Fix malformed attribute values
    const malformedQuotePattern = /(\s[a-zA-Z][a-zA-Z0-9_:-]*)=&quot;/
    if (malformedQuotePattern.test(fixed)) {
        fixed = fixed.replace(
            /(\s[a-zA-Z][a-zA-Z0-9_:-]*)=&quot;([^&]*?)&quot;/g,
            '$1="$2"',
        )
        fixes.push(
            'Fixed malformed attribute quotes (=&quot;...&quot; to ="...")',
        )
    }

    // 3c. Fix malformed closing tags
    const malformedClosingTag = /<\/([a-zA-Z][a-zA-Z0-9]*)\s*\/>/g
    if (malformedClosingTag.test(fixed)) {
        fixed = fixed.replace(/<\/([a-zA-Z][a-zA-Z0-9]*)\s*\/>/g, "</$1>")
        fixes.push("Fixed malformed closing tags (</tag/> to </tag>)")
    }

    // 3d. Fix missing space between attributes
    const missingSpacePattern = /("[^"]*")([a-zA-Z][a-zA-Z0-9_:-]*=)/g
    if (missingSpacePattern.test(fixed)) {
        fixed = fixed.replace(/("[^"]*")([a-zA-Z][a-zA-Z0-9_:-]*=)/g, "$1 $2")
        fixes.push("Added missing space between attributes")
    }

    // 3f. Fix extra spaces around attribute equals sign
    // e.g. style = "..." -> style="..."
    const extraSpaceEqualsPattern = /([a-zA-Z][a-zA-Z0-9_:-]*)\s+=\s+"/g
    if (extraSpaceEqualsPattern.test(fixed)) {
        fixed = fixed.replace(/([a-zA-Z][a-zA-Z0-9_:-]*)\s+=\s+"/g, '$1="')
        fixes.push("Removed extra spaces around attribute equals sign")
    }

    // 3g. Ensure mxGraphModel has default attributes
    if (fixed.includes("<mxGraphModel>") && !fixed.includes("<mxGraphModel ")) {
        // It has mxGraphModel but no attributes (or at least no space after tag name)
        // Check if it's just <mxGraphModel>
        if (/<mxGraphModel>/.test(fixed)) {
            const defaultAttrs = 'dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" background="none" math="0" shadow="0"'
            fixed = fixed.replace("<mxGraphModel>", `<mxGraphModel ${defaultAttrs}>`)
            fixes.push("Added default attributes to mxGraphModel")
        }
    }

    // 3e. Fix unescaped quotes in style color values
    const quotedColorPattern = /;([a-zA-Z]*[Cc]olor)="#/
    if (quotedColorPattern.test(fixed)) {
        fixed = fixed.replace(/;([a-zA-Z]*[Cc]olor)="#/g, ";$1=#")
        fixes.push("Removed quotes around color values in style")
    }

    // 4. Fix unescaped < in attribute values
    const attrPattern = /(=\s*")([^"]*?)(<)([^"]*?)(")/g
    let attrMatch
    let hasUnescapedLt = false
    while ((attrMatch = attrPattern.exec(fixed)) !== null) {
        if (!attrMatch[3].startsWith("&lt;")) {
            hasUnescapedLt = true
            break
        }
    }
    if (hasUnescapedLt) {
        fixed = fixed.replace(/=\s*"([^"]*)"/g, (_match, value) => {
            const escaped = value.replace(/</g, "&lt;")
            return `="${escaped}"`
        })
        fixes.push("Escaped < characters in attribute values")
    }

    // 5. Fix invalid character references
    const invalidHexRefs: string[] = []
    fixed = fixed.replace(/&#x([^;]*);/g, (match, hex) => {
        if (/^[0-9a-fA-F]+$/.test(hex) && hex.length > 0) {
            return match
        }
        invalidHexRefs.push(match)
        return ""
    })
    if (invalidHexRefs.length > 0) {
        fixes.push(
            `Removed ${invalidHexRefs.length} invalid hex character reference(s)`,
        )
    }

    // 6. Fix invalid decimal character references
    const invalidDecRefs: string[] = []
    fixed = fixed.replace(/&#([^x][^;]*);/g, (match, dec) => {
        if (/^[0-9]+$/.test(dec) && dec.length > 0) {
            return match
        }
        invalidDecRefs.push(match)
        return ""
    })
    if (invalidDecRefs.length > 0) {
        fixes.push(
            `Removed ${invalidDecRefs.length} invalid decimal character reference(s)`,
        )
    }

    // 7. Fix invalid comment syntax
    fixed = fixed.replace(/<!--([\s\S]*?)-->/g, (match, content) => {
        if (/--/.test(content)) {
            let fixedContent = content
            while (/--/.test(fixedContent)) {
                fixedContent = fixedContent.replace(/--/g, "-")
            }
            fixes.push("Fixed invalid comment syntax (removed double hyphens)")
            return `<!--${fixedContent}-->`
        }
        return match
    })

    // 8. Fix <Cell> tags
    const hasCellTags = /<\/?Cell[\s>]/i.test(fixed)
    if (hasCellTags) {
        fixed = fixed.replace(/<Cell(\s)/gi, "<mxCell$1")
        fixed = fixed.replace(/<Cell>/gi, "<mxCell>")
        fixed = fixed.replace(/<\/Cell>/gi, "</mxCell>")
        fixes.push("Fixed <Cell> tags to <mxCell>")
    }

    // 8a. Fix mxCell with text content (text should be in value attribute, not as child content)
    // Pattern: <mxCell ...>TEXT</mxCell> or <mxCell ...><mxGeometry .../>\nTEXT</mxCell>
    // This handles AI-generated XML where text is placed directly as child content instead of in value attribute
    const mxCellWithContentPattern = /<mxCell([^>]*?)>([\s\S]*?)<\/mxCell>/g
    let mxCellContentMatch
    const mxCellTextFixes: string[] = []

    // First pass: identify cells that need fixing
    while ((mxCellContentMatch = mxCellWithContentPattern.exec(fixed)) !== null) {
        const attributes = mxCellContentMatch[1]
        const innerContent = mxCellContentMatch[2]

        // Skip if already has value attribute
        if (/value\s*=/.test(attributes)) {
            continue
        }

        // Extract any geometry elements
        const hasGeometry = /<mxGeometry/.test(innerContent)

        // Extract text content (everything that's not XML tags)
        let textContent = innerContent
            .replace(/<mxGeometry[\s\S]*?\/>/g, '') // Remove self-closing mxGeometry
            .replace(/<mxGeometry[\s\S]*?<\/mxGeometry>/g, '') // Remove paired mxGeometry
            .trim()

        // If there's text content, record it for fixing
        if (textContent) {
            mxCellTextFixes.push(textContent)
        }
    }

    // Second pass: apply fixes
    if (mxCellTextFixes.length > 0) {
        fixed = fixed.replace(
            /<mxCell([^>]*?)>([\s\S]*?)<\/mxCell>/g,
            (match, attributes, innerContent) => {
                // Skip if already has value attribute
                if (/value\s*=/.test(attributes)) {
                    return match
                }

                // Extract geometry elements
                const geometryMatch = innerContent.match(/<mxGeometry[\s\S]*?(\/>|<\/mxGeometry>)/g)
                const geometryElements = geometryMatch ? geometryMatch.join('') : ''

                // Extract text content
                let textContent = innerContent
                    .replace(/<mxGeometry[\s\S]*?\/>/g, '')
                    .replace(/<mxGeometry[\s\S]*?<\/mxGeometry>/g, '')
                    .trim()

                // If no text content, keep original
                if (!textContent) {
                    return match
                }

                // Escape special XML characters in text
                const escapedText = textContent
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')

                // Reconstruct mxCell with value attribute
                if (geometryElements) {
                    // Has geometry: <mxCell ... value="text"><mxGeometry .../></mxCell>
                    return `<mxCell${attributes} value="${escapedText}">${geometryElements}</mxCell>`
                } else {
                    // No geometry: <mxCell ... value="text" />
                    return `<mxCell${attributes} value="${escapedText}" />`
                }
            }
        )
        fixes.push(`Fixed ${mxCellTextFixes.length} mxCell element(s) with text content - moved text to value attribute`)
    }

    // 8b. Remove non-draw.io tags
    const validDrawioTags = new Set([
        "mxfile",
        "diagram",
        "mxGraphModel",
        "root",
        "mxCell",
        "mxGeometry",
        "mxPoint",
        "Array",
        "Object",
        "mxRectangle",
    ])
    const foreignTagPattern = /<\/?([a-zA-Z][a-zA-Z0-9_]*)[^>]*>/g
    let foreignMatch
    const foreignTags = new Set<string>()
    while ((foreignMatch = foreignTagPattern.exec(fixed)) !== null) {
        const tagName = foreignMatch[1]
        if (!validDrawioTags.has(tagName)) {
            foreignTags.add(tagName)
        }
    }
    if (foreignTags.size > 0) {
        for (const tag of foreignTags) {
            fixed = fixed.replace(new RegExp(`<${tag}[^>]*>`, "gi"), "")
            fixed = fixed.replace(new RegExp(`</${tag}>`, "gi"), "")
        }
        fixes.push(
            `Removed foreign tags: ${Array.from(foreignTags).join(", ")}`,
        )
    }

    // 9. Fix common closing tag typos
    const tagTypos = [
        { wrong: /<\/mxElement>/gi, right: "</mxCell>", name: "</mxElement>" },
        { wrong: /<\/mxcell>/g, right: "</mxCell>", name: "</mxcell>" },
        {
            wrong: /<\/mxgeometry>/g,
            right: "</mxGeometry>",
            name: "</mxgeometry>",
        },
        { wrong: /<\/mxpoint>/g, right: "</mxPoint>", name: "</mxpoint>" },
        {
            wrong: /<\/mxgraphmodel>/gi,
            right: "</mxGraphModel>",
            name: "</mxgraphmodel>",
        },
    ]
    for (const { wrong, right, name } of tagTypos) {
        if (wrong.test(fixed)) {
            fixed = fixed.replace(wrong, right)
            fixes.push(`Fixed typo ${name} to ${right}`)
        }
    }

    // 9b. Remove incomplete tag at the end
    const lastLessThan = fixed.lastIndexOf('<');
    if (lastLessThan !== -1 && !fixed.slice(lastLessThan).includes('>')) {
        const fragment = fixed.slice(lastLessThan);
        // Check if we can safely close this tag instead of removing it
        // Look for the last quote that might be a closing quote of an attribute
        let lastQuoteIdx = -1;
        let quoteChar = '';

        // Find the last quote
        for (let i = fragment.length - 1; i >= 0; i--) {
            if (fragment[i] === '"' || fragment[i] === "'") {
                lastQuoteIdx = i;
                quoteChar = fragment[i];
                break;
            }
        }

        if (lastQuoteIdx !== -1) {
            // Check if it looks like a closing quote (preceded by non-quote, followed by space or end)
            // And ensure it's not an opening quote (preceded by =)
            const isOpeningQuote = fragment[lastQuoteIdx - 1] === '=';

            if (!isOpeningQuote) {
                // Count quotes to be sure (heuristic: even number of quotes usually means balanced)
                const quoteCount = (fragment.match(new RegExp(quoteChar, 'g')) || []).length;
                if (quoteCount % 2 === 0) {
                    // It's likely a closing quote. We can truncate here and add >
                    // This preserves the tag and its valid attributes so far
                    fixed = fixed.slice(0, lastLessThan + lastQuoteIdx + 1) + ">";
                    fixes.push("Closed incomplete tag at end");
                } else {
                    // Odd quotes, probably incomplete attribute. Remove the whole tag.
                    fixed = fixed.slice(0, lastLessThan);
                    fixes.push("Removed incomplete tag at end");
                }
            } else {
                // It's an opening quote, remove the whole tag
                fixed = fixed.slice(0, lastLessThan);
                fixes.push("Removed incomplete tag at end");
            }
        } else {
            // No quotes, just a bare <tagName... remove it
            fixed = fixed.slice(0, lastLessThan);
            fixes.push("Removed incomplete tag at end");
        }
    }

    // 10. Fix unclosed tags
    const tagStack: string[] = []
    const parsedTags = parseXmlTags(fixed)

    for (const { tagName, isClosing, isSelfClosing } of parsedTags) {
        if (isClosing) {
            const lastIdx = tagStack.lastIndexOf(tagName)
            if (lastIdx !== -1) {
                tagStack.splice(lastIdx, 1)
            }
        } else if (!isSelfClosing) {
            tagStack.push(tagName)
        }
    }

    if (tagStack.length > 0) {
        const tagsToClose: string[] = []
        for (const tagName of tagStack.reverse()) {
            const openCount = (
                fixed.match(new RegExp(`<${tagName}[\\s>]`, "gi")) || []
            ).length
            const closeCount = (
                fixed.match(new RegExp(`</${tagName}>`, "gi")) || []
            ).length
            if (openCount > closeCount) {
                tagsToClose.push(tagName)
            }
        }
        if (tagsToClose.length > 0) {
            const closingTags = tagsToClose.map((t) => `</${t}>`).join("\n")
            fixed = fixed.trimEnd() + "\n" + closingTags
            fixes.push(
                `Closed ${tagsToClose.length} unclosed tag(s): ${tagsToClose.join(", ")}`,
            )
        }
    }

    // 10b. Remove extra closing tags
    const tagCounts = new Map<
        string,
        { opens: number; closes: number; selfClosing: number }
    >()
    const fullTagPattern = /<(\/?[a-zA-Z][a-zA-Z0-9]*)[^>]*>/g
    let tagCountMatch
    while ((tagCountMatch = fullTagPattern.exec(fixed)) !== null) {
        const fullMatch = tagCountMatch[0]
        const tagPart = tagCountMatch[1]
        const isClosing = tagPart.startsWith("/")
        const isSelfClosing = fullMatch.endsWith("/>")
        const tagName = isClosing ? tagPart.slice(1) : tagPart

        let counts = tagCounts.get(tagName)
        if (!counts) {
            counts = { opens: 0, closes: 0, selfClosing: 0 }
            tagCounts.set(tagName, counts)
        }
        if (isClosing) {
            counts.closes++
        } else if (isSelfClosing) {
            counts.selfClosing++
        } else {
            counts.opens++
        }
    }

    for (const [tagName, counts] of tagCounts) {
        const extraCloses = counts.closes - counts.opens
        if (extraCloses > 0) {
            let removed = 0
            const closeTagPattern = new RegExp(`</${tagName}>`, "g")
            const matches = [...fixed.matchAll(closeTagPattern)]
            for (
                let i = matches.length - 1;
                i >= 0 && removed < extraCloses;
                i--
            ) {
                const match = matches[i]
                const idx = match.index ?? 0
                fixed = fixed.slice(0, idx) + fixed.slice(idx + match[0].length)
                removed++
            }
            if (removed > 0) {
                fixes.push(
                    `Removed ${removed} extra </${tagName}> closing tag(s)`,
                )
            }
        }
    }

    // 10c. Remove trailing garbage
    const closingTagPattern = /<\/[a-zA-Z][a-zA-Z0-9]*>|\/>/g
    let lastValidTagEnd = -1
    let closingMatch
    while ((closingMatch = closingTagPattern.exec(fixed)) !== null) {
        lastValidTagEnd = closingMatch.index + closingMatch[0].length
    }
    if (lastValidTagEnd > 0 && lastValidTagEnd < fixed.length) {
        const trailing = fixed.slice(lastValidTagEnd).trim()
        if (trailing) {
            fixed = fixed.slice(0, lastValidTagEnd)
            fixes.push("Removed trailing garbage after last XML tag")
        }
    }

    // 11. Fix nested mxCell by flattening
    // (Simplified version of w-next-ai-draw logic for brevity, focusing on duplicate IDs)
    const lines = fixed.split("\n")
    const newLines: string[] = []
    let nestedFixed = 0
    let extraClosingToRemove = 0

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const nextLine = lines[i + 1]

        if (
            nextLine &&
            /<mxCell\s/.test(line) &&
            /<mxCell\s/.test(nextLine) &&
            !line.includes("/>") &&
            !nextLine.includes("/>")
        ) {
            const id1 = line.match(/\bid\s*=\s*["']([^"']+)["']/)?.[1]
            const id2 = nextLine.match(/\bid\s*=\s*["']([^"']+)["']/)?.[1]

            if (id1 && id1 === id2) {
                nestedFixed++
                extraClosingToRemove++
                continue
            }
        }

        if (extraClosingToRemove > 0 && /^\s*<\/mxCell>\s*$/.test(line)) {
            extraClosingToRemove--
            continue
        }

        newLines.push(line)
    }

    if (nestedFixed > 0) {
        fixed = newLines.join("\n")
        fixes.push(`Flattened ${nestedFixed} duplicate-ID nested mxCell(s)`)
    }

    // 12. Fix duplicate IDs
    const seenIds = new Map<string, number>()
    const duplicateIds: string[] = []
    const idPattern = /\bid\s*=\s*["']([^"']+)["']/gi
    let idMatch
    while ((idMatch = idPattern.exec(fixed)) !== null) {
        const id = idMatch[1]
        seenIds.set(id, (seenIds.get(id) || 0) + 1)
    }
    for (const [id, count] of seenIds) {
        if (count > 1) duplicateIds.push(id)
    }
    if (duplicateIds.length > 0) {
        const idCounters = new Map<string, number>()
        fixed = fixed.replace(/\bid\s*=\s*["']([^"']+)["']/gi, (match, id) => {
            if (!duplicateIds.includes(id)) return match
            const count = idCounters.get(id) || 0
            idCounters.set(id, count + 1)
            if (count === 0) return match
            const newId = `${id}_dup${count}`
            return match.replace(id, newId)
        })
        fixes.push(`Renamed ${duplicateIds.length} duplicate ID(s)`)
    }

    // 9. Fix empty id attributes
    let emptyIdCount = 0
    fixed = fixed.replace(
        /<mxCell([^>]*)\sid\s*=\s*["']\s*["']([^>]*)>/g,
        (_match, before, after) => {
            emptyIdCount++
            const newId = `cell_${Date.now()}_${emptyIdCount}`
            return `<mxCell${before} id="${newId}"${after}>`
        },
    )
    if (emptyIdCount > 0) {
        fixes.push(`Generated ${emptyIdCount} missing ID(s)`)
    }

    // 13. Aggressive: drop broken mxCell elements that can't be fixed
    // Only do this if DOM parser still finds errors after all other fixes
    if (typeof DOMParser !== "undefined") {
        let droppedCells = 0
        let maxIterations = 10
        while (maxIterations-- > 0) {
            const parser = new DOMParser()
            const doc = parser.parseFromString(fixed, "text/xml")
            const parseError = doc.querySelector("parsererror")
            if (!parseError) break // Valid now!

            const errText = parseError.textContent || ""
            const match = errText.match(/(\d+):\d+:/)
            if (!match) break

            const errLine = parseInt(match[1], 10) - 1
            const lines = fixed.split("\n")

            // Find the mxCell containing this error line
            let cellStart = errLine
            let cellEnd = errLine

            // Go back to find <mxCell
            while (cellStart > 0 && !lines[cellStart].includes("<mxCell")) {
                cellStart--
            }

            // Go forward to find </mxCell> or />
            while (cellEnd < lines.length - 1) {
                if (
                    lines[cellEnd].includes("</mxCell>") ||
                    lines[cellEnd].trim().endsWith("/>")
                ) {
                    break
                }
                cellEnd++
            }

            // Remove these lines
            lines.splice(cellStart, cellEnd - cellStart + 1)
            fixed = lines.join("\n")
            droppedCells++
        }
        if (droppedCells > 0) {
            fixes.push(`Dropped ${droppedCells} unfixable mxCell element(s)`)
        }
    }

    return { fixed, fixes }
}

/**
 * Validates XML and attempts to fix if invalid
 * @param xml - The XML string to validate and potentially fix
 * @returns Object with validation result, fixed XML if applicable, and fixes applied
 */
/**
 * Some models emit edge mxCells with source/target stuck on the inner
 * <mxGeometry> instead of on the <mxCell> opening tag. drawio then renders the
 * edge as disconnected (no endpoints). Move those attrs up to the mxCell.
 */
export function normalizeEdgeAttrs(xml: string): string {
    return xml.replace(
        /<mxCell\b([^>]*?\bedge="1"[^>]*?)>([\s\S]*?)<\/mxCell>/g,
        (full, openAttrs, body) => {
            const hasSource = /\bsource\s*=/.test(openAttrs)
            const hasTarget = /\btarget\s*=/.test(openAttrs)
            const geomMatch = body.match(/<mxGeometry\b([^>]*?)(\/?)>/)
            if (!geomMatch) return full
            const geomAttrs = geomMatch[1]
            const srcMatch = !hasSource ? geomAttrs.match(/\bsource\s*=\s*"([^"]+)"/) : null
            const tgtMatch = !hasTarget ? geomAttrs.match(/\btarget\s*=\s*"([^"]+)"/) : null
            if (!srcMatch && !tgtMatch) return full
            let newGeomAttrs = geomAttrs
            let newOpenAttrs = openAttrs
            if (srcMatch) {
                newGeomAttrs = newGeomAttrs.replace(/\s*\bsource\s*=\s*"[^"]+"/, '')
                newOpenAttrs += ` source="${srcMatch[1]}"`
            }
            if (tgtMatch) {
                newGeomAttrs = newGeomAttrs.replace(/\s*\btarget\s*=\s*"[^"]+"/, '')
                newOpenAttrs += ` target="${tgtMatch[1]}"`
            }
            const newGeomTag = `<mxGeometry${newGeomAttrs}${geomMatch[2]}>`
            const newBody = body.replace(geomMatch[0], newGeomTag)
            return `<mxCell${newOpenAttrs}>${newBody}</mxCell>`
        }
    )
}

/**
 * Escape `<` / `>` inside double-quoted attribute values. Reasoning-model
 * outputs frequently embed raw `<br>` or `<b>` in `value="..."`, which makes
 * the whole XML unparseable (the `<` ends the attribute / starts a new tag).
 * After escaping, drawio's `html=1` cells still render the literal `<br>` as
 * a line break because that's the XML-decoded attribute value.
 */
export function escapeAttrAngleBrackets(xml: string): string {
    return xml.replace(
        /(\b[a-zA-Z][a-zA-Z0-9_:.-]*)\s*=\s*"([^"]*)"/g,
        (_m, attrName, value) => `${attrName}="${value.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"`,
    )
}

/**
 * Salvage the malformation `<mxCell ATTRS <mxGeometry ...//>` (no `>` to close
 * the mxCell opening tag, mxGeometry inlined, no `</mxCell>` to close the cell).
 * Convert to `<mxCell ATTRS><mxGeometry .../></mxCell>`. Without this, every
 * such cell is dropped by the per-cell parse check and the diagram comes back
 * empty. Run BEFORE the DOMParser-based fixers — otherwise DOMParser bails out
 * on the first one of these and the rest of the chain becomes a no-op.
 */
export function fixUnclosedMxCellTags(xml: string): string {
    return xml.replace(
        /<mxCell\b([^>]*?)\s+(<mxGeometry\b[^>]*\/>)/g,
        '<mxCell$1>$2</mxCell>'
    )
}

/**
 * XML doesn't allow duplicate attribute names on a single element, but some
 * models emit `<mxCell ... value="X" ... value="X" />` (often a copy-paste
 * artifact). DOMParser hard-fails on this. Keep the first occurrence per tag.
 */
export function dedupeAttributes(xml: string): string {
    return xml.replace(/<([a-zA-Z_][\w:.-]*)\b([^>]*)>/g, (full, tagName, attrs) => {
        const seen = new Set<string>()
        const cleaned = attrs.replace(
            /\s+([a-zA-Z_][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g,
            (m: string, name: string) => {
                if (seen.has(name)) return ''
                seen.add(name)
                return m
            },
        )
        return `<${tagName}${cleaned}>`
    })
}

/**
 * Some models split a single labelled shape into two cells: a "shape" cell
 * with style but no value, plus a "text" cell parented to the shape carrying
 * the (often HTML) value but no style. drawio renders the text cell with its
 * own (default) style, which means html=1 isn't applied and HTML is shown as
 * literal text. Merge such child-value cells into their parent and drop them.
 */
export function mergeChildValueIntoParent(xml: string): string {
    try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml')
        if (doc.getElementsByTagName('parsererror').length > 0) return xml
        const cells = Array.from(doc.getElementsByTagName('mxCell'))
        const byId = new Map<string, Element>()
        for (const c of cells) {
            const id = c.getAttribute('id')
            if (id) byId.set(id, c)
        }
        // Collect every id referenced as source/target — these cells are needed
        // by edges and MUST NOT be merged-out, even if they look like text helpers.
        const referencedByEdges = new Set<string>()
        for (const c of cells) {
            if (c.getAttribute('edge') !== '1') continue
            const src = c.getAttribute('source')
            const tgt = c.getAttribute('target')
            if (src) referencedByEdges.add(src)
            if (tgt) referencedByEdges.add(tgt)
        }
        const toRemove: Element[] = []
        for (const cell of cells) {
            const parentId = cell.getAttribute('parent')
            if (!parentId || parentId === '0' || parentId === '1') continue
            const value = cell.getAttribute('value')
            if (!value) continue
            const cellId = cell.getAttribute('id')
            if (cellId && referencedByEdges.has(cellId)) continue
            const parentCell = byId.get(parentId)
            if (!parentCell) continue
            if (parentCell.getAttribute('vertex') !== '1') continue
            if (parentCell.getAttribute('value')) continue
            parentCell.setAttribute('value', value)
            if (!parentCell.hasAttribute('style') && cell.hasAttribute('style')) {
                parentCell.setAttribute('style', cell.getAttribute('style') || '')
            }
            toRemove.push(cell)
        }
        if (toRemove.length === 0) return xml
        toRemove.forEach(c => c.parentNode?.removeChild(c))
        return new XMLSerializer().serializeToString(doc)
    } catch {
        return xml
    }
}

/**
 * Edge mxCells need `<Array as="points">` inside `<mxGeometry>`, and the
 * geometry itself needs `as="geometry"`. Some models put Array as a sibling
 * of mxGeometry (direct child of mxCell) and omit `as="geometry"`, which makes
 * drawio's mxGeometry decoder reject the geometry ("Could not add object
 * mxGeometry") and silently drop all waypoints. Fix both at once.
 */
export function fixEdgeArrayPoints(xml: string): string {
    try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml')
        if (doc.getElementsByTagName('parsererror').length > 0) return xml
        const cells = Array.from(doc.getElementsByTagName('mxCell'))
        let changed = false
        for (const cell of cells) {
            const directGeoms = Array.from(cell.children).filter(c => c.tagName === 'mxGeometry')
            for (const g of directGeoms) {
                if (!g.hasAttribute('as')) {
                    g.setAttribute('as', 'geometry')
                    changed = true
                }
            }
            const orphanArrays = Array.from(cell.children).filter(
                c => c.tagName === 'Array' && c.getAttribute('as') === 'points'
            )
            if (orphanArrays.length === 0) continue
            const targetGeom = directGeoms[0]
            if (!targetGeom) continue
            for (const arr of orphanArrays) {
                targetGeom.appendChild(arr)
                changed = true
            }
        }
        if (!changed) return xml
        return new XMLSerializer().serializeToString(doc)
    } catch {
        return xml
    }
}

/**
 * Drop extra <mxGeometry> children on the same mxCell. drawio uses the first
 * one and the extras either confuse the renderer or trigger "Could not add
 * object mxPoint" warnings when they wrap orphan points.
 */
export function dedupeMxGeometry(xml: string): string {
    try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml')
        if (doc.getElementsByTagName('parsererror').length > 0) return xml
        const cells = Array.from(doc.getElementsByTagName('mxCell'))
        let changed = false
        for (const cell of cells) {
            const geoms = Array.from(cell.children).filter(c => c.tagName === 'mxGeometry')
            if (geoms.length <= 1) continue
            // Prefer the first geometry that has both x/y AND width/height (a "real" one),
            // else fall back to the first.
            const sized = geoms.find(g => g.hasAttribute('x') && g.hasAttribute('width'))
            const keep = sized ?? geoms[0]
            for (const g of geoms) {
                if (g !== keep) {
                    g.parentNode?.removeChild(g)
                    changed = true
                }
            }
        }
        if (!changed) return xml
        return new XMLSerializer().serializeToString(doc)
    } catch {
        return xml
    }
}

/**
 * Assign synthetic ids to edge mxCells that lack one. drawio decodes such
 * edges as "cell null" and emits beforeDecode warnings; even when it then
 * generates an internal id, the noise is confusing.
 */
export function assignMissingEdgeIds(xml: string): string {
    try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml')
        if (doc.getElementsByTagName('parsererror').length > 0) return xml
        const cells = Array.from(doc.getElementsByTagName('mxCell'))
        const usedIds = new Set<string>()
        for (const c of cells) {
            const id = c.getAttribute('id')
            if (id) usedIds.add(id)
        }
        let counter = 1
        const nextId = () => {
            while (usedIds.has(`auto_edge_${counter}`)) counter++
            const id = `auto_edge_${counter}`
            usedIds.add(id)
            counter++
            return id
        }
        let changed = false
        for (const cell of cells) {
            if (cell.getAttribute('edge') !== '1') continue
            if (cell.hasAttribute('id')) continue
            cell.setAttribute('id', nextId())
            changed = true
        }
        if (!changed) return xml
        return new XMLSerializer().serializeToString(doc)
    } catch {
        return xml
    }
}

/**
 * Strip <img> tags from inside attribute values. Reasoning models occasionally
 * fabricate base64 PNG data URIs that look plausible but don't actually decode,
 * leaving broken-image icons (or worse, walls of raw base64 text) inside cell
 * labels. Removing the <img> entirely is less ugly than the broken render.
 */
export function stripImgTagsFromValues(xml: string): string {
    return xml.replace(/&lt;img\b[^&]*?(?:\/&gt;|&gt;(?:[^&]|&(?!lt;\/img&gt;))*?&lt;\/img&gt;)/gi, '')
}

/**
 * Some models forget to set `vertex="1"` / `edge="1"` on cells, even though they
 * provide `style`, `value`, `parent`, geometry, etc. drawio without an explicit
 * type flag renders the cell as a default/invisible shape, so the entire
 * diagram looks like just the edges with no nodes. Infer the type from context:
 *   - cell with `source` or `target` → edge="1"
 *   - cell with <mxGeometry x="..." width="..."/> → vertex="1"
 *   - otherwise leave alone (might be a group/layer cell)
 */
export function ensureVertexEdgeFlag(xml: string): string {
    try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml')
        if (doc.getElementsByTagName('parsererror').length > 0) return xml
        const cells = Array.from(doc.getElementsByTagName('mxCell'))
        let changed = false
        for (const cell of cells) {
            const id = cell.getAttribute('id')
            if (id === '0' || id === '1') continue
            if (cell.hasAttribute('vertex') || cell.hasAttribute('edge')) continue
            if (cell.hasAttribute('source') || cell.hasAttribute('target')) {
                cell.setAttribute('edge', '1')
                changed = true
                continue
            }
            const geom = Array.from(cell.children).find(c => c.tagName === 'mxGeometry')
            if (geom && geom.hasAttribute('x') && geom.hasAttribute('width')) {
                cell.setAttribute('vertex', '1')
                changed = true
            }
        }
        if (!changed) return xml
        return new XMLSerializer().serializeToString(doc)
    } catch {
        return xml
    }
}

/**
 * vertex / edge mxCells without a `parent` attribute end up parented to root
 * (cell id="0") instead of the default layer (cell id="1"), so they are not
 * rendered on the visible layer. Default the parent to "1" for any vertex or
 * edge that's missing it. Skip the structural cells with id="0" and id="1".
 */
export function ensureCellParent(xml: string): string {
    try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml')
        if (doc.getElementsByTagName('parsererror').length > 0) return xml
        const cells = Array.from(doc.getElementsByTagName('mxCell'))
        let changed = false
        for (const cell of cells) {
            const id = cell.getAttribute('id')
            if (id === '0' || id === '1') continue
            const isVertex = cell.getAttribute('vertex') === '1'
            const isEdge = cell.getAttribute('edge') === '1'
            if ((isVertex || isEdge) && !cell.hasAttribute('parent')) {
                cell.setAttribute('parent', '1')
                changed = true
            }
        }
        if (!changed) return xml
        return new XMLSerializer().serializeToString(doc)
    } catch {
        return xml
    }
}

/**
 * Vertex mxCells without an mxGeometry child render at (0,0) with zero size,
 * i.e. invisibly. Some models forget the geometry entirely. As a salvage
 * pass, lay missing vertices out in a coarse grid so the user at least sees
 * the nodes and can rearrange manually.
 */
export function ensureVertexGeometry(xml: string): string {
    try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml')
        if (doc.getElementsByTagName('parsererror').length > 0) return xml

        const cells = Array.from(doc.getElementsByTagName('mxCell'))
        const orphans: Element[] = []
        for (const cell of cells) {
            if (cell.getAttribute('vertex') !== '1') continue
            const hasGeom = Array.from(cell.children).some(c => c.tagName === 'mxGeometry')
            if (!hasGeom) orphans.push(cell)
        }
        if (orphans.length === 0) return xml

        const COLS = 4, W = 160, H = 60, PAD_X = 40, PAD_Y = 80, START_X = 40, START_Y = 40
        orphans.forEach((cell, i) => {
            const col = i % COLS, row = Math.floor(i / COLS)
            const geom = doc.createElement('mxGeometry')
            geom.setAttribute('x', String(START_X + col * (W + PAD_X)))
            geom.setAttribute('y', String(START_Y + row * (H + PAD_Y)))
            geom.setAttribute('width', String(W))
            geom.setAttribute('height', String(H))
            geom.setAttribute('as', 'geometry')
            cell.appendChild(geom)
        })
        return new XMLSerializer().serializeToString(doc)
    } catch {
        return xml
    }
}

/**
 * Reasoning models sometimes nest mxCells inside other mxCells to express the
 * parent/child relationship via DOM. drawio's model is flat — all mxCells are
 * siblings under <root>, with the logical parent expressed by the `parent`
 * attribute. Also, our streaming regex extractor stops at the first inner
 * </mxCell> and yields structurally broken cells.
 *
 * Fix: MOVE nested mxCells out to be direct children of <root> (preserving
 * their `parent` attribute), instead of deleting them. Deleting also kills
 * legitimate business cells that the model just happened to DOM-nest.
 */
export function flattenNestedMxCells(xml: string): string {
    try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml')
        if (doc.getElementsByTagName('parsererror').length > 0) return xml
        const root = doc.querySelector('mxGraphModel > root') || doc.querySelector('root')
        if (!root) return xml
        let changed = false
        for (let i = 0; i < 1000; i++) {
            const cells = Array.from(doc.getElementsByTagName('mxCell'))
            const nested = cells.find(c => c.parentElement?.tagName === 'mxCell')
            if (!nested) break
            root.appendChild(nested)
            changed = true
        }
        if (!changed) return xml
        return new XMLSerializer().serializeToString(doc)
    } catch {
        return xml
    }
}

/**
 * Compute a sensible viewport (dx / dy on <mxGraphModel>) based on the bbox of
 * the actual vertex cells, so drawio's load() lands the camera on the content
 * instead of somewhere off in canvas space (the "tiny diagram in bottom-right"
 * symptom). We pick dx / dy that would center the bbox in a typical iframe
 * viewport; if drawio interprets dx / dy with a different sign convention,
 * the worst case is content showing up shifted but still visible — which is
 * already strictly better than the current behavior.
 *
 * Skips silently when:
 *   - There are no vertex cells (nothing to center on);
 *   - The XML doesn't parse (let other passes handle it);
 *   - The user has already set dx / dy (don't fight their manual pan).
 */
export function setViewportToContentCenter(xml: string): string {
    try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml')
        if (doc.getElementsByTagName('parsererror').length > 0) return xml
        const model = doc.querySelector('mxGraphModel')
        if (!model) return xml
        if (model.hasAttribute('dx') || model.hasAttribute('dy')) return xml

        const cells = Array.from(doc.getElementsByTagName('mxCell'))
        let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity
        let counted = 0
        for (const cell of cells) {
            if (cell.getAttribute('vertex') !== '1') continue
            const geom = Array.from(cell.children).find(c => c.tagName === 'mxGeometry')
            if (!geom) continue
            const x = parseFloat(geom.getAttribute('x') || '')
            const y = parseFloat(geom.getAttribute('y') || '')
            const w = parseFloat(geom.getAttribute('width') || '0')
            const h = parseFloat(geom.getAttribute('height') || '0')
            if (!isFinite(x) || !isFinite(y)) continue
            xmin = Math.min(xmin, x)
            ymin = Math.min(ymin, y)
            xmax = Math.max(xmax, x + (isFinite(w) ? w : 0))
            ymax = Math.max(ymax, y + (isFinite(h) ? h : 0))
            counted++
        }
        if (counted === 0 || !isFinite(xmin)) return xml

        // Estimate iframe viewport; precise size isn't known here, but for
        // typical editor chrome ~1100×750 is close enough that content lands
        // in view even if off by a couple hundred pixels.
        const IFRAME_W = 1100
        const IFRAME_H = 750
        const cx = (xmin + xmax) / 2
        const cy = (ymin + ymax) / 2
        const dx = Math.round(IFRAME_W / 2 - cx)
        const dy = Math.round(IFRAME_H / 2 - cy)

        model.setAttribute('dx', String(dx))
        model.setAttribute('dy', String(dy))
        return new XMLSerializer().serializeToString(doc)
    } catch {
        return xml
    }
}

/**
 * Strip AI-fabricated viewport offsets from <mxGraphModel>. Negative or
 * non-integer dx/dy cause drawio to land the viewport away from the content
 * (the "diagram in the bottom-right of a huge canvas" symptom). User pans are
 * persisted by drawio's autoSave path, not this validator, so we're safe to
 * drop them here.
 */
export function stripFabricatedViewport(xml: string): string {
    return xml.replace(/<mxGraphModel\b[^>]*>/g, tag =>
        tag.replace(/\s+dx="[^"]*"/g, '').replace(/\s+dy="[^"]*"/g, '')
    )
}

/**
 * Ensure <mxGraphModel> has the standard drawio attributes. When the merge path
 * inherits an attribute-less <mxGraphModel> (e.g. from the empty fallback
 * template), drawio's viewport ends up in an unpredictable place and the page
 * dimensions are unset, producing the "huge empty canvas with content in the
 * corner" symptom. Add any missing attrs; never overwrite user-set values.
 */
export function ensureMxGraphModelDefaults(xml: string): string {
    // NOTE: intentionally omit dx / dy. drawio uses its internal auto-fit logic
    // when the model has no explicit view translation; setting dx="0" dy="0"
    // pins the viewport to canvas origin and pushes content (positioned at
    // x=100+, y=100+) into the bottom-right of the iframe.
    const defaults: [string, string][] = [
        ['grid', '1'],
        ['gridSize', '10'],
        ['guides', '1'],
        ['tooltips', '1'],
        ['connect', '1'],
        ['arrows', '1'],
        ['fold', '1'],
        ['page', '1'],
        ['pageScale', '1'],
        ['pageWidth', '827'],
        ['pageHeight', '1169'],
        ['math', '0'],
        ['shadow', '0'],
    ]
    return xml.replace(/<mxGraphModel\b([^>]*)>/g, (_full, attrs) => {
        let next = attrs
        for (const [key, val] of defaults) {
            if (!new RegExp(`\\b${key}\\s*=`).test(next)) {
                next += ` ${key}="${val}"`
            }
        }
        return `<mxGraphModel${next}>`
    })
}

/**
 * Drop edges whose source/target is missing in a way that drawio can't repair:
 * literal string "null" or empty string. Both are common AI mistakes; both
 * inflate layout bounds and trigger beforeDecode warnings (and the empty form
 * tends to come paired with a malformed self-close + trailing content that
 * later passes can't disentangle).
 */
export function dropDanglingNullEdges(xml: string): string {
    const danglingValue = `"(?:null|-1|)"`
    // Self-closing with optional orphan trailing <mxGeometry .../></mxCell> tail
    // (the model emits `... target=""/>` then mistakenly appends content + closing).
    const selfClose = new RegExp(
        `<mxCell\\b[^>]*\\bedge="1"[^>]*\\b(?:source|target)=${danglingValue}[^>]*\\/>` +
        `(?:\\s*<mxGeometry\\b[^>]*(?:\\/>|>[\\s\\S]*?<\\/mxGeometry>)\\s*<\\/mxCell>)?` +
        `\\s*`,
        'g'
    )
    const blockClose = new RegExp(
        `<mxCell\\b[^>]*\\bedge="1"[^>]*\\b(?:source|target)=${danglingValue}[^>]*>[\\s\\S]*?<\\/mxCell>\\s*`,
        'g'
    )
    return xml.replace(selfClose, '').replace(blockClose, '')
}

export function validateAndFixXml(xml: string): string {
    if (!xml || !xml.trim()) return ''

    xml = escapeAttrAngleBrackets(xml)
    xml = fixUnclosedMxCellTags(xml)
    xml = dedupeAttributes(xml)
    xml = flattenNestedMxCells(xml)
    xml = mergeChildValueIntoParent(xml)
    xml = stripImgTagsFromValues(xml)
    xml = fixEdgeArrayPoints(xml)
    xml = dedupeMxGeometry(xml)
    xml = assignMissingEdgeIds(xml)
    xml = ensureVertexEdgeFlag(xml)
    xml = ensureCellParent(xml)
    xml = ensureVertexGeometry(xml)
    xml = normalizeEdgeAttrs(xml)
    xml = dropDanglingNullEdges(xml)
    xml = stripFabricatedViewport(xml)
    // setViewportToContentCenter intentionally not called: drawio ignores our
    // dx/dy when load() is invoked on an already-initialized iframe. The fit
    // is now handled in DrawioEditor by remounting the iframe so drawio's own
    // auto-fit runs during the new init.
    xml = ensureMxGraphModelDefaults(xml)

    // First validation attempt
    const error = validateMxCellStructure(xml)

    if (!error) {
        return xml
    }

    // Try to fix
    const { fixed, fixes } = autoFixXml(xml)

    // If we have fixes, return the fixed version
    // Even if it's still technically invalid, it's better than the original
    // and might be renderable by draw.io's lenient parser
    if (fixes.length > 0) {
        return fixed
    }

    return xml
}

// ============================================================================
// Diagram Operations for Partial Editing
// ============================================================================

export interface DiagramOperation {
  operation: 'update' | 'add' | 'delete'
  cell_id: string
  new_xml?: string
}

export interface OperationError {
  type: 'update' | 'add' | 'delete'
  cellId: string
  message: string
}

export interface ApplyOperationsResult {
  result: string
  errors: OperationError[]
}

/**
 * Apply diagram operations (update/add/delete) using ID-based lookup.
 * This enables partial editing of draw.io diagrams without full regeneration.
 *
 * @param xmlContent - The full mxfile XML content
 * @param operations - Array of operations to apply
 * @returns Object with result XML and any errors
 */
export function applyDiagramOperations(
  xmlContent: string,
  operations: DiagramOperation[],
): ApplyOperationsResult {
  const errors: OperationError[] = []

  console.log('[applyDiagramOperations] START ========================')
  console.log('[applyDiagramOperations] Input XML length:', xmlContent.length)
  console.log('[applyDiagramOperations] Operations:', JSON.stringify(operations, null, 2))

  // Parse the XML
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'text/xml')

  // Check for parse errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    return {
      result: xmlContent,
      errors: [
        {
          type: 'update',
          cellId: '',
          message: `XML parse error: ${parseError.textContent}`,
        },
      ],
    }
  }

  // Find the root element (inside mxGraphModel)
  const root = doc.querySelector('root')
  if (!root) {
    return {
      result: xmlContent,
      errors: [
        {
          type: 'update',
          cellId: '',
          message: 'Could not find <root> element in XML',
        },
      ],
    }
  }

  // Build a map of cell IDs to elements
  const cellMap = new Map<string, Element>()
  root.querySelectorAll('mxCell').forEach((cell) => {
    const id = cell.getAttribute('id')
    if (id) cellMap.set(id, cell)
  })

  console.log('[applyDiagramOperations] Total cells in document:', cellMap.size)
  console.log('[applyDiagramOperations] Cell IDs:', Array.from(cellMap.keys()).slice(0, 20))

  // Process each operation
  for (const op of operations) {
    if (op.operation === 'update') {
      const existingCell = cellMap.get(op.cell_id)
      if (!existingCell) {
        errors.push({
          type: 'update',
          cellId: op.cell_id,
          message: `Cell with id="${op.cell_id}" not found`,
        })
        continue
      }

      if (!op.new_xml) {
        errors.push({
          type: 'update',
          cellId: op.cell_id,
          message: 'new_xml is required for update operation',
        })
        continue
      }

      // Parse the new XML
      const newDoc = parser.parseFromString(
        `<wrapper>${op.new_xml}</wrapper>`,
        'text/xml',
      )
      const newCell = newDoc.querySelector('mxCell')
      if (!newCell) {
        errors.push({
          type: 'update',
          cellId: op.cell_id,
          message: 'new_xml must contain an mxCell element',
        })
        continue
      }

      // Validate ID matches
      const newCellId = newCell.getAttribute('id')
      if (newCellId !== op.cell_id) {
        errors.push({
          type: 'update',
          cellId: op.cell_id,
          message: `ID mismatch: cell_id is "${op.cell_id}" but new_xml has id="${newCellId}"`,
        })
        continue
      }

      // Import and replace the node
      const importedNode = doc.importNode(newCell, true)
      existingCell.parentNode?.replaceChild(importedNode, existingCell)

      // Update the map with the new element
      cellMap.set(op.cell_id, importedNode)
    } else if (op.operation === 'add') {
      // Check if ID already exists
      if (cellMap.has(op.cell_id)) {
        errors.push({
          type: 'add',
          cellId: op.cell_id,
          message: `Cell with id="${op.cell_id}" already exists`,
        })
        continue
      }

      if (!op.new_xml) {
        errors.push({
          type: 'add',
          cellId: op.cell_id,
          message: 'new_xml is required for add operation',
        })
        continue
      }

      // Parse the new XML
      const newDoc = parser.parseFromString(
        `<wrapper>${op.new_xml}</wrapper>`,
        'text/xml',
      )
      const newCell = newDoc.querySelector('mxCell')
      if (!newCell) {
        errors.push({
          type: 'add',
          cellId: op.cell_id,
          message: 'new_xml must contain an mxCell element',
        })
        continue
      }

      // Validate ID matches
      const newCellId = newCell.getAttribute('id')
      if (newCellId !== op.cell_id) {
        errors.push({
          type: 'add',
          cellId: op.cell_id,
          message: `ID mismatch: cell_id is "${op.cell_id}" but new_xml has id="${newCellId}"`,
        })
        continue
      }

      // Import and append the node
      const importedNode = doc.importNode(newCell, true)
      root.appendChild(importedNode)

      // Add to map
      cellMap.set(op.cell_id, importedNode)
    } else if (op.operation === 'delete') {
      // Protect root cells from deletion
      if (op.cell_id === '0' || op.cell_id === '1') {
        errors.push({
          type: 'delete',
          cellId: op.cell_id,
          message: `Cannot delete root cell "${op.cell_id}"`,
        })
        continue
      }

      const existingCell = cellMap.get(op.cell_id)
      if (!existingCell) {
        // Cell not found - might have been cascade-deleted by a previous operation
        // Skip silently instead of erroring (AI may redundantly list children/edges)
        continue
      }

      // Cascade delete: collect all cells to delete (children + edges + self)
      const cellsToDelete = new Set<string>()

      // Recursive function to find all descendants
      const collectDescendants = (cellId: string) => {
        if (cellsToDelete.has(cellId)) return
        cellsToDelete.add(cellId)

        // Find children (cells where parent === cellId)
        const children = root.querySelectorAll(
          `mxCell[parent="${cellId}"]`,
        )
        children.forEach((child) => {
          const childId = child.getAttribute('id')
          if (childId && childId !== '0' && childId !== '1') {
            collectDescendants(childId)
          }
        })
      }

      // Collect the target cell and all its descendants
      collectDescendants(op.cell_id)

      // Find edges referencing any of the cells to be deleted
      // Also recursively collect children of those edges (e.g. edge labels)
      for (const cellId of cellsToDelete) {
        const referencingEdges = root.querySelectorAll(
          `mxCell[source="${cellId}"], mxCell[target="${cellId}"]`,
        )
        referencingEdges.forEach((edge) => {
          const edgeId = edge.getAttribute('id')
          // Protect root cells from being added via edge references
          if (edgeId && edgeId !== '0' && edgeId !== '1') {
            // Recurse to collect edge's children (like labels)
            collectDescendants(edgeId)
          }
        })
      }

      // Log what will be deleted
      if (cellsToDelete.size > 1) {
        console.log(
          `[applyDiagramOperations] Cascade delete "${op.cell_id}" → deleting ${cellsToDelete.size} cells: ${Array.from(cellsToDelete).join(', ')}`,
        )
      }

      // Delete all collected cells
      for (const cellId of cellsToDelete) {
        const cell = cellMap.get(cellId)
        if (cell) {
          cell.parentNode?.removeChild(cell)
          cellMap.delete(cellId)
        }
      }
    }
  }

  // Serialize back to string
  const serializer = new XMLSerializer()
  const result = serializer.serializeToString(doc)

  console.log('[applyDiagramOperations] Output XML length:', result.length)
  console.log('[applyDiagramOperations] Output XML (first 500 chars):', result.substring(0, 500))
  console.log('[applyDiagramOperations] END ========================')

  return { result, errors }
}

/**
 * Parse edit operations from AI response
 * Looks for <edit_operations>...</edit_operations> tags
 */
export function parseEditOperations(content: string): { operations: DiagramOperation[] | null, hasOperations: boolean } {
  const operationsMatch = content.match(/<edit_operations>([\s\S]*?)<\/edit_operations>/)
  if (!operationsMatch) {
    return { operations: null, hasOperations: false }
  }

  try {
    // Clean up the JSON string
    let jsonStr = operationsMatch[1].trim()

    // Check if JSON is complete (basic validation)
    // Count opening and closing braces/brackets
    const openBraces = (jsonStr.match(/\{/g) || []).length
    const closeBraces = (jsonStr.match(/\}/g) || []).length
    const openBrackets = (jsonStr.match(/\[/g) || []).length
    const closeBrackets = (jsonStr.match(/\]/g) || []).length

    if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
      console.log('[parseEditOperations] JSON appears incomplete, skipping parse')
      return { operations: null, hasOperations: true }
    }

    // Handle escaped quotes from LLM - LLM might escape quotes as \"
    // We need to handle this carefully
    // First, let's try parsing as-is
    let operations: DiagramOperation[]
    try {
      operations = JSON.parse(jsonStr)
    } catch (parseError) {
      // If that fails, try fixing common LLM JSON issues
      // Replace \" with " (unescape the quotes)
      const fixedJson = jsonStr.replace(/\\"/g, '"')
      operations = JSON.parse(fixedJson)
    }

    // Validate operations
    if (!Array.isArray(operations)) {
      console.error('[parseEditOperations] Operations is not an array')
      return { operations: null, hasOperations: true }
    }

    // Validate each operation
    for (const op of operations) {
      if (!op.operation || !['update', 'add', 'delete'].includes(op.operation)) {
        console.error('[parseEditOperations] Invalid operation type:', op.operation)
        return { operations: null, hasOperations: true }
      }
      if (!op.cell_id) {
        console.error('[parseEditOperations] Missing cell_id in operation')
        return { operations: null, hasOperations: true }
      }
    }

    return { operations, hasOperations: true }
  } catch (error) {
    console.error('[parseEditOperations] Failed to parse operations:', error)
    console.error('[parseEditOperations] Raw content:', operationsMatch[1].substring(0, 500))
    return { operations: null, hasOperations: true }
  }
}

/**
 * Strip reasoning-model <think>...</think> blocks. Closed blocks are removed;
 * an unclosed <think> (still streaming or never terminated by the model) is
 * dropped from its opening up to the next real XML root start, so downstream
 * XML detection isn't fooled by pseudo-XML the model wrote inside its reasoning.
 */
export function stripThinkBlocks(content: string): string {
  let result = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  const thinkIdx = result.search(/<think>/i)
  if (thinkIdx === -1) return result
  const xmlIdx = result.slice(thinkIdx).search(/<(\?xml|mxGraphModel|mxfile)\b/i)
  if (xmlIdx === -1) return result.substring(0, thinkIdx).trim()
  return (result.substring(0, thinkIdx) + result.substring(thinkIdx + xmlIdx)).trim()
}

/**
 * Extract plan and code from the AI response
 */
export function parseResponse(content: string): { plan: string | null, code: string | null, operations: DiagramOperation[] | null } {
  // Capture <think> for ThoughtBlock display before we strip it from downstream parsing.
  // Reasoning models put long-form reasoning here; surfacing it as plan content lets the
  // UI show the "思考过程" block even when the model never emits an explicit <plan>.
  let thinkText: string | null = null
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i)
  if (thinkMatch) {
    thinkText = thinkMatch[1].trim()
  } else if (/<think>/i.test(content)) {
    // <think> opened but not yet closed: stream partial reasoning into thinkText; no code yet.
    const idx = content.search(/<think>/i)
    thinkText = content.substring(idx + '<think>'.length).trim()
    return { plan: thinkText, code: null, operations: null }
  }

  content = stripThinkBlocks(content)
  let plan: string | null = thinkText
  let code: string | null = null
  let remaining = content

  // 1. Try to find <plan> tags (used only as fallback when no <think>)
  const planMatch = content.match(/<plan>([\s\S]*?)<\/plan>/)
  if (planMatch) {
    if (!plan) plan = planMatch[1].trim()
    remaining = content.replace(planMatch[0], '').trim()
  } else if (content.includes('<plan>')) {
    if (!plan) {
      const start = content.indexOf('<plan>')
      plan = content.substring(start + 6).trim()
      return { plan, code: null, operations: null }
    }
    // think already provides display content; strip partial plan tail from remaining
    remaining = content.substring(0, content.indexOf('<plan>')).trim()
  }

  // 2. Check for edit operations first
  const { operations, hasOperations } = parseEditOperations(content)
  if (hasOperations && operations) {
    // Only return operations if they were successfully parsed
    return { plan, code: null, operations }
  } else if (hasOperations && !operations) {
    // Operations tag exists but JSON is incomplete (streaming)
    // Return null for everything to indicate we're still waiting
    return { plan, code: null, operations: null }
  }

  // 3. Try to find code in 'remaining'
  let codeStart = -1

  // Check for Markdown code blocks
  const codeBlockMatch = remaining.match(/```(?:mermaid|json|xml)?\n?([\s\S]*?)```/i)
  if (codeBlockMatch) {
    code = codeBlockMatch[1].trim()
    codeStart = remaining.indexOf(codeBlockMatch[0])
  } else if (remaining.includes('```')) {
    // Partial code block
    const start = remaining.indexOf('```')
    const newline = remaining.indexOf('\n', start)
    if (newline !== -1) {
      code = remaining.substring(newline + 1).trim()
    } else {
      code = ''
    }
    codeStart = start
  } else {
    // Check for direct XML (Draw.io)
    // Look for <?xml or <mxGraphModel or <mxfile
    const xmlStartMatch = remaining.match(/(<\?xml|<mxGraphModel|<mxfile)/)
    if (xmlStartMatch) {
        const start = xmlStartMatch.index!
        const endMatch = remaining.match(/(<\/mxGraphModel>|<\/mxfile>)/)
        if (endMatch) {
            code = remaining.substring(start, endMatch.index! + endMatch[0].length).trim()
        } else {
            code = remaining.substring(start).trim()
        }
        codeStart = start
    }
    // Check for direct JSON
    else if (remaining.trim().startsWith('[')) {
       code = remaining.trim()
       codeStart = remaining.indexOf('[')
    }
    // Check for direct Mermaid
    else {
        const mermaidKeywords = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie', 'gitGraph', 'C4Context', 'mindmap']
        for (const kw of mermaidKeywords) {
            if (remaining.trim().startsWith(kw)) {
                code = remaining.trim()
                codeStart = remaining.indexOf(kw)
                break
            }
        }
    }
  }

  // 4. If plan was not found via tags, try to infer it
  if (!plan) {
      if (codeStart > 0) {
          // Everything before code is plan
          plan = remaining.substring(0, codeStart).trim()
      } else if (codeStart === -1 && remaining.trim()) {
          // No code found, everything is plan
          plan = remaining.trim()
      }
  }

  return { plan, code, operations }
}

