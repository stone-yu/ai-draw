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
    // This regex will match either self-closing <mxCell .../> or a block element
    // <mxCell ...> ... </mxCell>. Unfinished ones are left out because they don't match.
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
export function validateAndFixXml(xml: string): string {
    if (!xml || !xml.trim()) return ''

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

/**
 * Extract plan and code from the AI response
 */
export function parseResponse(content: string): { plan: string | null, code: string | null } {
  let plan: string | null = null
  let code: string | null = null
  let remaining = content

  // 1. Try to find <plan> tags
  const planMatch = content.match(/<plan>([\s\S]*?)<\/plan>/)
  if (planMatch) {
    plan = planMatch[1].trim()
    remaining = content.replace(planMatch[0], '').trim()
  } else if (content.includes('<plan>')) {
    // Partial plan (streaming)
    const start = content.indexOf('<plan>')
    plan = content.substring(start + 6).trim()
    return { plan, code: null }
  }

  // 2. Try to find code in 'remaining'
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

  // 3. If plan was not found via tags, try to infer it
  if (!plan) {
      if (codeStart > 0) {
          // Everything before code is plan
          plan = remaining.substring(0, codeStart).trim()
      } else if (codeStart === -1 && remaining.trim()) {
          // No code found, everything is plan
          plan = remaining.trim()
      }
  }

  return { plan, code }
}

