// Visual tool which allows to add colors in console
const chalk = require('chalk');

// Delete anything in the database by its ID
// Note that a function cannot be named 'delete' in node
const deleteFunction = async (
    // Command additional arguments
    { id, confirm },
    // Database handler
    database,
) => {
    console.log(chalk.cyan(`== Deletion of '${id}'`));
    // Find the document with the requested Id, no matter in which collection it is
    const target = await database.findId(id);
    // If nothing is found then we are done
    if (!target) return console.error(chalk.yellow(`Nothing found for ID '${id}'`));
    // Warn the user about the document we are about to delete and ask for confirmation
    const documentName = database.nameCollectionDocument(target.collection);
    // If the confirm argument has not been passed then ask the user for confirmation
    if (!confirm) {
        const confirmation = await userConfirm(`Confirm deletion of of ${documentName} with id ${id} [y/*]`);
        if (confirmation !== 'y' && confirmation !== 'Y') return console.log('Data deletion has been aborted');
    }
    // Use the right deleting protocol according to the type of document we are about to delete
    // ----- Analysis -----
    if (target.collection === database.analyses) {
        // Load remote project data in the database handler
        await database.syncProject(target.document.project);
        // Delete the analysis
        const name = target.document.name;
        const mdIndex = target.document.md;
        return await database.deleteAnalysis(name, mdIndex);
    }
    // ----- Files -----
    if (target.collection === database.files) {
        // Load remote project data in the database handler
        await database.syncProject(target.document.metadata.project);
        // Delete the file
        const filename = target.document.filename;
        const mdIndex = target.document.metadata.md;
        return await database.deleteFile(filename, mdIndex);
    }
    throw new Error(`Deletion of ${documentName} is not yet supported`);
};

module.exports = deleteFunction;