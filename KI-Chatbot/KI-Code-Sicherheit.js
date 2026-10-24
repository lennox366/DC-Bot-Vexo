
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createCodeSafety(projectRoot) {
    const root = fs.realpathSync(path.resolve(projectRoot));

    function resolveFile(file) {
        if (typeof file !== 'string' || !file.trim()) {
            throw new Error('Ungültiger Dateiname');
        }

        const name = file.replace(/\\/g, '/');

        if (
            path.posix.isAbsolute(name) ||
            path.win32.isAbsolute(file) ||
            name.split('/').includes('..') ||
            !/\.(js|json)$/i.test(name)
        ) {
            throw new Error(`Dateipfad nicht erlaubt: ${file}`);
        }

        const target = path.resolve(root, name);
        const relative = path.relative(root, target);

        if (
            relative.startsWith('..' + path.sep) ||
            relative === '..' ||
            path.isAbsolute(relative)
        ) {
            throw new Error('Datei liegt außerhalb des Projekts');
        }

        // Vorhandene übergeordnete Verzeichnisse prüfen,
        // damit Symlinks nicht aus dem Projekt herausführen.
        let current = path.dirname(target);

        while (current !== root) {
            if (fs.existsSync(current)) {
                const real = fs.realpathSync(current);
                const rel = path.relative(root, real);

                if (
                    rel === '..' ||
                    rel.startsWith('..' + path.sep) ||
                    path.isAbsolute(rel)
                ) {
                    throw new Error('Unsicherer Symlink-Pfad');
                }
            }

            const parent = path.dirname(current);
            if (parent === current) {
                throw new Error('Ungültiger Projektpfad');
            }
            current = parent;
        }

        if (fs.existsSync(target)) {
            const stat = fs.lstatSync(target);

            if (!stat.isFile()) {
                throw new Error('Ziel ist keine reguläre Datei');
            }
        }

        return target;
    }

    function checkSyntax(filename, content) {
        if (filename.endsWith('.json')) {
            JSON.parse(content);
            return;
        }

        new vm.Script(content, {
            filename,
            displayErrors: true
        });
    }

    function countOccurrences(text, search) {
        if (!search) return 0;

        let count = 0;
        let position = 0;

        while (true) {
            const index = text.indexOf(search, position);
            if (index === -1) break;

            count++;
            position = index + search.length;
        }

        return count;
    }

    function prepareChanges(changes) {
        if (!Array.isArray(changes) || !changes.length) {
            throw new Error('Keine Änderungen vorhanden');
        }

        const prepared = [];
        const seen = new Set();

        for (const change of changes) {
            if (!change || typeof change !== 'object') {
                throw new Error('Ungültige Änderung');
            }

            const file = change.file;
            const target = resolveFile(file);

            if (seen.has(target)) {
                throw new Error(
                    `Mehrere Änderungen an derselben Datei: ${file}`
                );
            }

            seen.add(target);

            if (typeof change.new !== 'string') {
                throw new Error(`Neuer Code fehlt: ${file}`);
            }

            const exists = fs.existsSync(target);
            const action = change.action;

            if (!['create', 'replace'].includes(action)) {
                throw new Error(
                    `Unbekannte Aktion für ${file}: ${action}`
                );
            }

            if (action === 'create' && exists) {
                throw new Error(
                    `Datei existiert bereits: ${file}. ` +
                    'Die KI muss eine Änderung vorschlagen.'
                );
            }

            if (action === 'replace' && !exists) {
                throw new Error(
                    `Datei existiert nicht: ${file}. ` +
                    'Die KI muss "create" verwenden.'
                );
            }

            const original = exists
                ? fs.readFileSync(target, 'utf8')
                : null;

            let result;

            if (action === 'create') {
                result = change.new;
            } else {
                if (
                    typeof change.old !== 'string' ||
                    !change.old.length
                ) {
                    throw new Error(
                        `Alter Codeabschnitt fehlt: ${file}`
                    );
                }

                const matches = countOccurrences(
                    original,
                    change.old
                );

                if (matches !== 1) {
                    throw new Error(
                        `Codestelle nicht eindeutig in ${file}. ` +
                        `Gefundene Treffer: ${matches}`
                    );
                }

                result = original.replace(
                    change.old,
                    () => change.new
                );
            }

            checkSyntax(file, result);

            prepared.push({
                file,
                target,
                action,
                original,
                result
            });
        }

        return prepared;
    }

    function validateProposal(changes) {
        try {
            const prepared = prepareChanges(changes);

            return {
                ok: true,
                files: prepared.map(item => ({
                    file: item.file,
                    action: item.action
                }))
            };
        } catch (error) {
            return {
                ok: false,
                error: error.message
            };
        }
    }

    function applyApprovedChanges(changes, options = {}) {
        if (options.approved !== true) {
            throw new Error(
                'Änderungen benötigen eine bestätigte Freigabe.'
            );
        }

        // Freigabe und Passwortprüfung müssen im
        // bestehenden KI-Code-Manager erfolgen.
        const prepared = prepareChanges(changes);

        const backupRoot = path.join(
            root,
            '.ki-code-backups',
            `backup-${Date.now()}`
        );

        fs.mkdirSync(backupRoot, { recursive: true });

        // Alle vorhandenen Dateien vor Änderungen sichern.
        for (const item of prepared) {
            if (item.original === null) continue;

            const backupFile = path.join(
                backupRoot,
                item.file
            );

            fs.mkdirSync(path.dirname(backupFile), {
                recursive: true
            });

            fs.writeFileSync(
                backupFile,
                item.original,
                'utf8'
            );
        }

        const written = [];

        try {
            for (const item of prepared) {
                // Vor dem Schreiben erneut prüfen, ob
                // sich die Datei seit der Planung geändert hat.
                const current = fs.existsSync(item.target)
                    ? fs.readFileSync(item.target, 'utf8')
                    : null;

                if (current !== item.original) {
                    throw new Error(
                        `Datei wurde zwischenzeitlich geändert: ${item.file}`
                    );
                }

                fs.mkdirSync(path.dirname(item.target), {
                    recursive: true
                });

                fs.writeFileSync(
                    item.target,
                    item.result,
                    'utf8'
                );

                written.push(item);
            }

            return {
                ok: true,
                files: written.map(item => item.file),
                backupDirectory: backupRoot
            };
        } catch (error) {
            // Bereits geschriebene Dateien zurücksetzen.
            for (const item of written.reverse()) {
                try {
                    if (item.original === null) {
                        fs.unlinkSync(item.target);
                    } else {
                        fs.writeFileSync(
                            item.target,
                            item.original,
                            'utf8'
                        );
                    }
                } catch (rollbackError) {
                    console.error(
                        '[KI-CODE] Wiederherstellung fehlgeschlagen:',
                        item.file,
                        rollbackError
                    );
                }
            }

            throw error;
        }
    }

    return {
        resolveFile,
        checkSyntax,
        validateProposal,
        prepareChanges,
        applyApprovedChanges
    };
}

module.exports = { createCodeSafety };
